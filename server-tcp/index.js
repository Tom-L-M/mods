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

function startTcpServer(context) {
    const net = require('net');
    const { host, port, content } = context;
    return net
        .createServer(function (socket) {
            const { remoteAddress, remotePort } = socket;
            const client = remoteAddress + ':' + remotePort;

            logger.info({ event: 'connect', client });

            socket.on('data', function (data) {
                logger.info(
                    { event: 'data', client },
                    `Received: ${data.length} bytes\n` +
                        prettifyRawRequestData(data)
                );
                socket.write(content);
                logger.info(
                    { event: 'response', client },
                    `Sent ${content.length} bytes`
                );
            });

            socket.on('close', function () {
                logger.info({ event: 'disconnect', client });
            });

            socket.on('error', function (err) {
                logger.error({ event: 'reset', client }, err.message);
            });
        })
        .listen(port, host, () => {
            logger.print(
                `[+] Exposed Interface: (TCP) ${host}:${port}`,
                'yellow'
            );
            logger.print(
                `[+] Local Link: tcp://` +
                    (host !== '0.0.0.0' ? host : '127.0.0.1') +
                    `:${port}/\n`,
                'yellow'
            );
        });
}

(function wrapper() {
    const fs = require('fs');
    const args = process.argv.slice(2);
    const help = `
    [server-tcp-js]
        A tool for creating and running raw TCP servers

    Usage:
        server-tcp [--help] [--port PORT] [--host HOST] [--file/--text CONTENT]

    Universal Options:
        --help    | -h  : Shows this help menu
        --version | -v  : Shows version information
        --port    | -p  : Selects a port to use (default is 8000)
        --host    | -o  : Selects an interface to use (default is '0.0.0.0')
        --file    | -f  : Responds requests with a file data
        --text    | -t  : Responds requests with a string`;

    const context = {
        args: args,
        help: help,
        host: '0.0.0.0',
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
        if (!context.port) context.port = 8000;
        if (!context.content) context.content = 'OK';
        startTcpServer(context);
    } catch (err) {
        console.log(err.message);
    }
})();
