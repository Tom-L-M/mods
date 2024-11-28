const sendBroadcastUdpPacket = context => {
    const { message, port, host } = context;
    /* message<String|Buffer>, silent<Boolean>, empty<Boolean>, port<String|Number>, host<String> */

    const udp = require('dgram');
    const client = udp.createSocket('udp4');
    const data = Buffer.from(message);

    client.on('message', function (msg) {
        console.log(
            `> Data received (${msg.length} bytes) \n` + msg.toString()
        );
    });

    client.send(data, port, host, function (error) {
        if (error) {
            client.close();
            console.log(`> Client unreacheable >> [udp@${host}:${port}]`);
        } else {
            console.log(`> Client reached >> [udp@${host}:${port}]`);
            console.log(`> Data sent (${data.length} bytes)`);
        }
        client.close();
    });
};

const isValidIP = value =>
    /^(?:(?:^|\.)(?:2(?:5[0-5]|[0-4]\d)|1?\d?\d)){4}$/.test(value);
const isValidMAC = value =>
    /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(value);

const parseMAC = MACstr => {
    return (
        MACstr.length == 12
            ? MACstr.match(new RegExp(`.{1,2}`, 'gim'))
            : MACstr.split(MACstr[2])
    ).map(x => parseInt(x, 16));
};

const buildMessage = MACaddr => {
    // MACaddr must be an array of numbers: ex:[255, 78, 24, 55, 32, 11]
    return Buffer.from([
        0,
        ...new Array(6).fill(0xff),
        ...new Array(16).fill(MACaddr).flat(),
        0,
    ]);
};

(function () {
    const help = `
        [wake-on-lan-js]
            A tool to send Wake-On-LAN magic packets

        Usage:
            wake-on-lan <NETWORK> <MAC> [-p PORT] [-h|--help] [-v|--version]

        Info:
            Default port for WOL is: 7 (udp).

            The 'NETWORK' must be the IPv4 address of the network.
            Passing partial or incomplete addresses will not work.
            Correct Example: 192.168.15.0 for a /24 network. 

            The MAC address can be passed as a non-divided string, 
            or with the following separators: - / : / . (never mixed).
            Valid:     
                00:11:22:33:44:55       00-11-22-33-44-55
                00.11.22.33.44.55       001122334455
            Invalid:
                00/11/22/33/44/55 ('/' is not allowed as separator)
                0-11-22-33-44-55  (MAC bytes must be complete, even if starting with zero)

        Example: (waking on local network in port 9 - alternative to default port)
            wake-on-lan 192.168.15.0 ff:ff:ff:ff:ff:ff -p 9`;

    const args = process.argv.slice(2);
    const network = args[0];
    const macaddr = args[1];
    let port = 7;

    if (args.includes('-h') || args.includes('--help') || !args[0]) {
        return console.log(help);
    }

    if (args.includes('-v') || args.includes('--version')) {
        return console.log(require('./package.json')?.version);
    }

    if (!network || !isValidIP(network)) {
        return console.log(
            '<> Error: Invalid network provided [' + (network || '') + ']'
        );
    }

    if (!macaddr || !isValidMAC(macaddr)) {
        return console.log(
            '<> Error: Invalid MAC address provided [' + (macaddr || '') + ']'
        );
    }

    if (args.includes('-p')) {
        let i = args.indexOf('-p') + 1;
        port = args[i];
    } else if (args.includes('--port')) {
        let i = args.indexOf('--port') + 1;
        port = args[i];
    }

    const host = [...network.split('.').slice(0, 3), '255'].join('.');
    const message = buildMessage(parseMAC(macaddr));

    sendBroadcastUdpPacket({ port: port, host: host, message: message });
})();
