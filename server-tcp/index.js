const { Logger, ArgvParser } = require('../shared');
const logger = new Logger({
    format: msg => {
        return (
            `[${msg.timestamp}] ` +
            `${msg.level.toUpperCase()} ` +
            `${msg.event.toUpperCase()} ` +
            msg.client +
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

function startTcpServer(host, port, content, { dump } = {}) {
    const net = require('net');
    return net
        .createServer(function (socket) {
            const { remoteAddress, remotePort } = socket;
            const client = remoteAddress + ':' + remotePort;

            // Avoid printing connection-related events, pollutes the terminal
            // logger.info({ event: 'connect', client });

            socket.on('data', function (data) {
                logger.info(
                    { event: 'request', client },
                    `Received ${data.length} bytes` +
                        (dump ? '\n' + prettifyRawRequestData(data) : '')
                );
                socket.write(content);
                logger.info(
                    { event: 'response', client },
                    `Sent ${content.length} bytes`
                );
            });

            // Avoid printing connection-related events, pollutes the terminal
            // socket.on('close', function () {
            //     logger.info({ event: 'disconnect', client });
            // });

            // Avoid printing connection-related events, pollutes the terminal
            // socket.on('error', function (err) {
            //     logger.error({ event: 'reset', client }, err.message);
            // });
        })
        .listen(port, host, () => {
            logger.print(
                `[+] Exposed Interface: (TCP) ${host}:${port}`,
                'yellow'
            );
            logger.print(
                `[+] Local Link: tcp://` +
                    (host !== '0.0.0.0' ? host : '127.0.0.1') +
                    `:${port}/`,
                'yellow'
            );
            logger.print(
                `[+] Responding with ${content.length} bytes\n`,
                'yellow'
            );
        });
}

(function wrapper() {
    const fs = require('fs');
    const help = `
    [server-tcp-js]
        A tool for creating and running raw TCP servers

    Usage:
        server-tcp [options]

    Options:
        -h | --help         Shows this help menu
        -v | --version      Shows version information
        -p | --port PORT    Selects a port to use (default is 8000)
        -o | --host HOST    Selects an interface to use (default is '0.0.0.0')
        -f | --file FILE    Responds requests with a file data
        -t | --text TEXT    Responds requests with a string
        -D | --no-dump      Prevents printing hexdumps from requests`;

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('no-dump', { alias: 'D', allowValue: false });
    parser.option('port', { alias: 'p' });
    parser.option('host', { alias: 'h' });
    parser.option('file', { alias: 'f' });
    parser.option('text', { alias: 't' });
    const args = parser.parseArgv();

    const context = {
        args: args,
        help: help,
        host: '0.0.0.0',
        port: 8000,
        content: 'OK',
        dump: true,
    };

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help) return console.log(help);
    if (args.host) context.host = args.host;
    if (args.port) context.port = args.port;
    if (args.text) context.content = args.text;

    logger.disableColors();
    if (args['no-dump']) context.dump = false;

    if (args.file) {
        try {
            context.content = fs.readFileSync(args.file);
        } catch {
            return logger.print(
                'Fatal Error: Could not read file "' + args.file + '"',
                'red'
            );
        }
    }

    try {
        startTcpServer(context.host, context.port, context.content, {
            dump: context.dump,
        });
    } catch (err) {
        logger.print('Server Fatal Error: ' + err.message, 'red');
        process.exit(1);
    }
})();
