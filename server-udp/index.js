function startUdpServer(context) {
    const dgram = require('dgram');
    const { host, port, content } = context;
    const server = dgram.createSocket('udp4');
    server.on('message', function (message, remote) {
        let date = new Date();
        let now =
            date.toString().split(' ')[4] +
            '.' +
            date.getMilliseconds().toString().padStart(3, '0');
        console.log(
            `\n> ${now} > Connection Request: udp@${host}:${port} <> udp@${remote.address}:${remote.port}`
        );
        console.log(
            `> ${now} > Received data (${
                message.length
            } bytes): \n  ${message} \n  [${[...Buffer.from(message)]
                .map(x => x.toString(16).padStart(2, '0'))
                .join(' ')
                .toUpperCase()}]`
        );
        server.send(content, remote.port, remote.address, err => {
            if (err)
                console.log(
                    `\n> ${now} > Packet Sending Failed: udp@${host}:${port} <> udp@${remote.address}:${remote.port} -> ${err}`
                );
        });
        console.log(`> ${now} > Sent data (${content.length} bytes)`);
    });
    server.on('error', function (err) {
        let date = new Date();
        let now =
            date.toString().split(' ')[4] +
            '.' +
            date.getMilliseconds().toString().padStart(3, '0');
        console.log(`\n> ${now} > Server Error -> ${err}`);
    });
    server.bind(port, host, () => {
        console.log(
            '>> Automatic config used. Use --help to access the help menu.'
        );
        console.log(`>> UDP server running on udp://${host}:${port}/`);
    });
    return server;
}

(function wrapper() {
    const fs = require('fs');
    const args = process.argv.slice(2);
    const help = `
    [server-udp-js]
     
    Description:
        A tool for creating and running raw UDP servers

    Usage:
        server-udp [--help] [--port PORT] [--host HOST] [--file/--text CONTENT]

    Universal Options:
        --help    | -h  : Shows this help menu
        --version | -v  : Shows version information
        --port    | -p  : Selects a port to use (default is 5000)
        --host    | -o  : Selects an interface to use (default is '0.0.0.0')
        --file    | -f  : Responds requests with a file data
        --text    | -t  : Responds requests with a string`;
    const context = {
        args: args,
        help: help,
        host: '0.0.0.0',
        protocol: (args[0] || '').toLowerCase(),
        port: null,
        content: null,
    };

    for (let i = 0; i < args.length; i++) {
        let arg = args[i];
        let next = args[++i];

        switch (arg) {
            case '-h':
            case '--help':
                return console.log(help);

            case '-v':
            case '--version':
                return console.log(require('./package.json')?.version);

            case '-o':
            case '--host':
                context.host = next;
                break;

            case '-p':
            case '--port':
                context.port = next;
                break;

            case '-f':
            case '--file':
                context.content = fs.readFileSync(next);
                break;

            case '-t':
            case '--text':
                context.content = next;
                break;

            default:
        }
    }

    try {
        if (!context.port) context.port = 5000;
        if (!context.content) context.content = '<UDP/>';
        startUdpServer(context);
    } catch (err) {
        console.log(err.message);
    }
})();
