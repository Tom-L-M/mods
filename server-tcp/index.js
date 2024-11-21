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
                    'Received ' + data.length + ' bytes'
                );
                socket.write(content);
            });

            socket.on('close', function () {
                logger.info({ event: 'disconnect', client });
            });

            socket.on('error', function (err) {
                logger.error({ event: 'reset', client }, err.message);
            });
        })
        .listen(port, host, () => {
            logger.print(`[+] Exposed Interface: ${host}:${port}`, 'yellow');
            if (host === '0.0.0.0') {
                logger.print(
                    `[+] Local Link: tcp://127.0.0.1:${port}/\n`,
                    'yellow'
                );
            } else {
                logger.print(
                    `[+] Local Link: tcp://${host}:${port}/\n`,
                    'yellow'
                );
            }
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
