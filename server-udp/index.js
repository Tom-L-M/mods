const { Logger } = require('../shared');
const logger = new Logger({
    format: msg => {
        return (
            `[${msg.timestamp}] ` +
            `${msg.level.toUpperCase()} ` +
            `${msg.event.toUpperCase()} ` +
            `tcp://${msg.client}` +
            (msg.message ? ' - ' + msg.message : '')
        );
    },
});

function prettifyRawRequestData(buffer) {
    const chunkify = (s, w) =>
        s.match(new RegExp(`.{1,${w >= 1 ? w : 1}}`, 'gim')) ?? [];
    const stringFromBuffer = [...buffer]
        .map(v => '0x' + v.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
    const chunkedString = chunkify(buffer.toString(), 16);
    const chunkedBuffer = chunkify(stringFromBuffer, 16 * 5);
    return chunkedBuffer
        .map(
            (v, i) =>
                '  ' +
                v.padEnd(16 * 5, ' ') +
                ' |' +
                (chunkedString[i] || '').padEnd(16, ' ') +
                '|'
        )
        .join('\n');
}

function startUdpServer(context) {
    const dgram = require('dgram');
    const { host, port, content } = context;
    const server = dgram.createSocket('udp4');
    server.on('message', function (message, remote) {
        const client = remote.address + ':' + remote.port;

        logger.info(
            { event: 'data', client },
            `Received ${message.length} bytes\n` +
                prettifyRawRequestData(message)
        );

        server.send(content, remote.port, remote.address, err => {
            if (err)
                logger.error(
                    { event: 'fail', client },
                    'Packet Sending Failed: ' + err
                );
        });
        logger.info(
            { event: 'response', client },
            `Sent ${content.length} bytes`
        );
    });
    server.on('error', function (err) {
        logger.error({ event: 'fail', client: 'Server Error: ' + err.message });
    });
    server.bind(port, host, () => {
        logger.print(`[+] Exposed Interface: (UDP) ${host}:${port}`, 'yellow');
        logger.print(
            `[+] Local Link: udp://` +
                (host !== '0.0.0.0' ? host : '127.0.0.1') +
                `:${port}/\n`,
            'yellow'
        );
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
        logger.print('Server Fatal Error: ' + err.message, 'red');
        process.exit(1);
    }
})();
