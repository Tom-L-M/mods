const safeResolve = async (resolutionFunction, target) => {
    try {
        return await resolutionFunction(target);
    } catch {
        return null;
    }
};

const resolveDNSQuery = async context => {
    const { Resolver } = require('dns').promises;
    const dns = new Resolver();
    const { target, servers, query } = context;

    dns.setServers(servers);

    let acc;
    try {
        switch (query) {
            case 'ALL':
            case '*':
                acc = [
                    await safeResolve(dns.resolve4, target),
                    await safeResolve(dns.resolve6, target),
                    await safeResolve(dns.resolveCaa, target),
                    await safeResolve(dns.resolveCname, target),
                    await safeResolve(dns.resolveMx, target),
                    await safeResolve(dns.resolveNaptr, target),
                    await safeResolve(dns.resolveNs, target),
                    await safeResolve(dns.resolvePtr, target),
                    await safeResolve(dns.resolveSoa, target),
                    await safeResolve(dns.resolveSrv, target),
                    await safeResolve(dns.resolveTxt, target),
                    await safeResolve(dns.resolveSoa, target),
                    await safeResolve(dns.resolveSoa, target),
                ];
                return acc;
            case 'ANY':
                return await dns.resolveAny(target);
            case 'A':
                return await dns.resolve4(target);
            case 'AAAA':
                return await dns.resolve6(target);
            case 'CAA':
                return await dns.resolveCaa(target);
            case 'CNAME':
                return await dns.resolveCname(target);
            case 'MX':
                return await dns.resolveMx(target);
            case 'NAPTR':
                return await dns.resolveNaptr(target);
            case 'NS':
                return await dns.resolveNs(target);
            case 'PTR':
                return await dns.resolvePtr(target);
            case 'SOA':
                return await dns.resolveSoa(target);
            case 'SRV':
                return await dns.resolveSrv(target);
            case 'TXT':
                return await dns.resolveTxt(target);
            case 'REVERSE':
                return await dns.reverse(target);
            default:
                return (
                    '<> Error: Invalid query type specified: [' + query + ']'
                );
        }
    } catch (err) {
        return err.message;
    }
};

(async function main() {
    const help = `
    [client-dns-js]
        A tool for mining DNS data from a server
    
    Usage:
        client-dns TARGET [options]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -s | --server       Define a custom DNS server for executing the query - defaults to 8.8.8.8:53
        -q | --query        The query type to resolve - defaults to 'ANY'
        -n | --no-fallback  Prevents falling to secondary server if primary can't resolve it

    Info:
        > You can (or not) pass a specific port for '--server' flag. If no port is provided, 53 is assumed.
        > TARGET may be either a hostname or an (v4 or v6) IP address (for reverse queries only)
        > The default servers for resolution are Google's '8.8.8.8', and CloudFlare's '1.1.1.1'.
        > Some servers do not implement 'ANY' resolution operation, so, to achieve a full response, 
          use 'ALL'. It may differ on Google's DNS specially, so remember to try it for better results
        > Available query types:
            'ALL' or '*'    (All other options below at once)
            'A'             (IPv4 addresses)
            'AAAA'          (IPv6 addresses)
            'ANY'           (Any records)
            'CAA'           (CA authorization records)
            'CNAME'         (Canonical name records)
            'MX'            (Mail exchange records)
            'NAPTR'         (Name authority pointer records)
            'NS'            (Name server records)
            'PTR'           (Pointer records)
            'SOA'           (Start of authority records)
            'SRV'           (Service records)
            'TXT'           (Text records)`;

    const args = process.argv.slice(2);

    if (args.includes('-v') || args.includes('--version'))
        return console.log(require('./package.json')?.version);

    if (args.length < 1 || args.includes('--help') || args.includes('-h'))
        return console.log(help);

    const options = {
        target: args[0],
        servers: ['8.8.8.8', '1.1.1.1'],
        query: 'ANY',
        no_fallback: false,
    };

    for (let arg = 0; arg < args.length; arg++) {
        switch (args[arg]) {
            case '-s':
            case '--server':
                options.servers[1] = options.servers[0]; // remove fallback server
                options.servers[0] = args[++arg]; // add a new primary server
                break;

            case '-q':
            case '--query':
                options.query = args[++arg].toUpperCase();
                break;

            case '-n':
            case '--no-fallback':
                options.no_fallback = true;
                break;
        }
    }

    // Remove the fallback option only here - to avoid param order problems
    // remove the secondary DNS server (keep only primary)
    if (options.no_fallback) options.servers = [options.servers[0]];

    console.log(
        `\n > Asking [${options.servers.join(' or ')}] for ${
            options.query
        } records of ${options.target}`
    );

    let result = await resolveDNSQuery(options);
    console.log(result);
})();
