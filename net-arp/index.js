const os = require('node:os');
const child_process = require('node:child_process');
const { ArgvParser } = require('../shared');

// 00:00:00:00:00:00 -> 00-00-00-00-00-00
// 00.00.00.00.00.00 -> 00-00-00-00-00-00
// 00/00/00/00/00/00 -> 00-00-00-00-00-00
// 00-00-00-00-00-00 -> 00-00-00-00-00-00
// 0-0-0-0-0-0       -> 00-00-00-00-00-00
const normalizeMAC = mac =>
    mac
        .split(mac.replace(/[a-f0-9]/gi, '')[0])
        .map(x => x.padStart(2, '0'))
        .join('-');
const splitNetwork24 = value => value.split('.').slice(0, -1).join('.') + '.';
const isValidToken = value => value == '@' || value == '@@';
const isValidIP = value =>
    /^(?:(?:^|\.)(?:2(?:5[0-5]|[0-4]\d)|1?\d?\d)){4}$/.test(value);
const isValidMAC = value =>
    /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(value);
const getSelfInterface = () =>
    Object.values(os.networkInterfaces())
        .flat()
        .filter(x => !x.internal && x.family === 'IPv4')[0];
const findEntryInARPTable = (table, val) =>
    table.filter(x => x.ip == val || x.mac == val)[0] || null;
const pingIP = ip =>
    new Promise(resolve =>
        child_process.exec('ping -n 1 ' + ip, () => resolve())
    );
const pingAllIPs = async addr =>
    await Promise.all(
        new Array(254)
            .fill(0)
            .map((x, i) => pingIP(splitNetwork24(addr) + (i + 1)))
    );

function fetchARPTable() {
    const isWindows = process.platform.substring(0, 3) === 'win';
    const command = isWindows ? 'arp -a' : 'arp -an';
    try {
        const result = child_process.execSync(command).toString('utf-8');
        const rows = result.split('\n');
        const table = [];
        for (const row of rows) {
            let ip, mac, type;
            if (isWindows) {
                [ip, mac, type] = row.trim().replace(/\s+/g, ' ').split(' ');
            } else {
                const match = /.*\((.*?)\) \w+ (.{0,17}) (?:\[ether]|on)/g.exec(
                    row
                );
                if (match && match.length === 3) {
                    ip = match[1];
                    mac = normalizeMAC(match[2]);
                    type = 'unknown';
                } else {
                    continue;
                }
            }
            if (!isValidIP(ip) || !isValidMAC(mac)) continue;
            // Fix the accent bug in latin languages:
            type = type.toLowerCase();
            if (type.startsWith('di') || type.startsWith('dy'))
                type = 'Dynamic';
            if (type.startsWith('es') || type.startsWith('st')) type = 'Static';

            table.push({ ip, mac: normalizeMAC(mac), type });
        }
        return table;
    } catch (err) {
        console.log(err.message);
        return null;
    }
}

(async function main() {
    const help = `
    [net-arp-js]
        A tool for resolving IPs or MACs in a local network

    Usage:
        net-arp [options] <IP|MAC|@|@@>

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.

    Info:
        - @ : Fetch all IP-MAC pairs for the current local network from the ARP table.
          This uses the current cached ARP table. And is faster.

        - @@ : Fetch all IP-MAC pairs from ARP table and force discovery of other ones.
          This forces the build of a new ARP table. And is coniderably slower.
        
        - IP|MAC : This will trigger a series of ICMP requests - which may not bring all results if 
          targets in the network block ping probes. In that case, a UDP or TCP scan will 
          be best suited.`;

    const parser = new ArgvParser();
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('help', { alias: 'h', allowValue: false });
    parser.argument('address');
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || !args.address) return console.log(help);
    const address = args.address;

    // Check if is a valid IP/MAC
    if (!isValidIP(address) && !isValidMAC(address) && !isValidToken(address)) {
        return console.log('<> Error: Invalid IP/MAC address provided.');
    }

    // Check if the asked ip/mac is the same as the current machine:
    // Actually ARP does not index the own machine's addresses
    const self = getSelfInterface();
    self.ip = self.address; // just correcting the name for clarity
    if (self.mac === address || self.ip === address) {
        return console.log(`${self.ip} <> ${self.mac}   (Static) (Self)`);
    }

    // Fetch ARP table:
    let arpTable = fetchARPTable();

    // Check if is an 'all cached' token (@)
    if (address == '@') {
        // Return all ip-mac pairs cached in the ARP table
        let network = splitNetwork24(self.ip);
        let valid = [];
        for (let entry of arpTable) {
            if (entry.ip.startsWith(network)) {
                valid.push(entry);
            }
        }
        if (valid.length == 0)
            return console.log(
                '<> Error: no hosts found in network - try "@@" option to rebuild ARP table'
            );
        return console.log(
            valid
                .map(x => `${x.ip}\t    ${normalizeMAC(x.mac)}     (${x.type})`)
                .join('\n')
        );
    }

    // Check if is an 'all non-cached' token (@)
    else if (address == '@@') {
        // Ping all IPs to force build of new arp table
        let pingResult = await pingAllIPs(self.ip);
        // If error, return error message
        if (!pingResult)
            return console.log(
                '<> Error: Could not build ARP table through PING - host is unreacheable.'
            );
        // Re-fetch arp table
        arpTable = fetchARPTable();
        // Return all ip-mac pairs cached in the ARP table
        let network = splitNetwork24(self.ip);
        let valid = [];
        for (let entry of arpTable) {
            if (entry.ip.startsWith(network)) {
                valid.push(entry);
            }
        }
        if (valid.length == 0)
            return console.log(
                '<> Error: no hosts found in network - check if ping probes are allowed'
            );
        return console.log(
            valid
                .map(x => `${x.ip}\t    ${normalizeMAC(x.mac)}     (${x.type})`)
                .join('\n')
        );
    }

    // For requesting a MAC or IP:
    else {
        // Check for the entry in there:
        let arpEntry = findEntryInARPTable(arpTable, address);

        // If in ARP table, return the address
        if (arpEntry)
            return console.log(
                `${arpEntry.ip}\t    ${normalizeMAC(arpEntry.mac)}     (${
                    arpEntry.type
                })`
            );

        let pingResult;
        // If it is not in ARP table - and is an IP: ping the address to fetch the MAC
        if (isValidIP(address)) pingResult = await pingIP(address);
        // If it is not in ARP table - and is a MAC pings all IP addresses (/24) to find correspondence
        else if (isValidMAC(address)) pingResult = await pingAllIPs(self.ip);

        // If error, return error message
        if (!pingResult)
            return console.log(
                '<> Error: Could not build ARP table through PING - host is unreacheable.'
            );

        // If success, fetch ARP table and check for the IP/MAC in there:
        arpTable = fetchARPTable();
        arpEntry = findEntryInARPTable(arpTable, address);

        // If in ARP table, return the entry:
        if (arpEntry)
            return console.log(
                `${arpEntry.ip}\t    ${normalizeMAC(arpEntry.mac)}     (${
                    arpEntry.type
                })`
            );

        // If still not in ARP table, return error
        return console.log(
            `<> Error: Could not find host with matching [${address}]. Host may be offline, or out of network bound.`
        );
    }
})();
