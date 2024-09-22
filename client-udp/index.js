const fs = require('fs');

const sendUdpPacket = context => {
    const { message, keepalive, silent, empty, port, host } = context;
    /* message<String|Buffer>, silent<Boolean>, empty<Boolean>, port<String|Number>, host<String> */

    const udp = require('dgram');
    const client = udp.createSocket('udp4');
    const data = !empty ? Buffer.from(message) : Buffer.from('');

    client.on('message', function (msg) {
        let buf = [...msg]
            .map(v => v.toString(16).padStart(2, '0'))
            .join(' ')
            .toUpperCase();
        if (!silent)
            console.log(
                `> Data received (${msg.length} bytes) \n  ${msg.toString(
                    'utf-8'
                )} \n  [${buf}] `
            );
    });

    client.send(data, port, host, function (error) {
        if (error) {
            client.close();
            if (!silent)
                console.log(`> Client unreacheable >> [udp@${host}:${port}]`);
        } else {
            if (!silent)
                console.log(`> Client reached >> [udp@${host}:${port}]`);
            if (!silent) console.log(`> Data sent (${data.length} bytes)`);
        }
        if (!keepalive) client.close();
    });
};

const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

function printVersion() {
    try {
        console.log(require(exeresolve('client-udp/package.json')).version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

(function _wrapper() {
    const args = process.argv.slice(2);

    const help = `
    [client-udp-js]
        A tool for sending UDP packets for servers and services

    Usage:
        client-udp <targetHost> <targetPort> [options]

    Options:
        -h | --help                Prints the help message and quits.
        -v | --version             Prints the version info and quits.
        -s | --silent              Prevents response logging in the terminal
        -k | --keep-alive          Keeps connection alive
        -e | --empty               Sends an empty packet - no data
        -t | --text TEXT           Sends a specific text as data in packet
        -b | --bytes BYTES         Sends a specific series of hex bytes as data in packet
        -f | --file FILENAME       Reads a file and sends its contents as data

    Info:
        Tip: Setting an IP address with end '.255' allows for local network broadcast

    Example: (sending a DNS packet to 1.1.1.1)
        client-udp 1.1.1.1 53 -k -b "b9 1f 1 0 0 1 0 0 0 0 0 0 6 67 6f 6f 67 6c 65 3 63 6f 6d 0 0 1 0 1"

    Example: (sending text to UDP server)
        client-udp 127.0.0.1 2000 -t "some text"`;

    if (args[0] == '--help' || args[0] == '-h' || args.length == 0)
        return console.log(help);

    if (args.includes('--version') || args.includes('-v'))
        return printVersion();

    if (args.length < 2)
        return console.log(
            '<> Error: Not enought arguments passed. Use --help to access the help menu.'
        );

    const context = {
        args: args,
        host: args[0],
        port: args[1],
        empty: false,
        silent: false,
        keepalive: false,
        message: [0x00],
    };

    for (let i = 0; i < args.length; i++) {
        let arg = args[i];
        switch (arg) {
            case '-t':
            case '--text': // --text "somecontent"
                context.message = args[++i];
                break;

            case '-b':
            case '--bytes': // --bytes "73 6f 6d 65 63 6f 6e 74 65 6e 74"
                context.message = args[++i]
                    .split(' ')
                    .map(x => parseInt(x, 16));
                break;

            case '-f':
            case '--file': // --file ./example/file.bin
                context.message = fs.readFileSync(args[i]);
                break;

            case '-k':
            case '--keep-alive':
                context.keepalive = true;
                break;

            case '-s':
            case '--silent':
                context.silent = true;
                break;

            case '-e':
            case '--empty':
                context.empty = true;
                break;
        }
    }

    sendUdpPacket(context);
})();
