const net = require('net');

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

function startChargenServer(host, port) {
    function getNextChunk(start) {
        const characters =
            ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
        const realstart = start % 95;
        const line =
            (characters.slice(realstart) + characters).slice(0, 72) + '\r\n';
        return line;
    }

    return net
        .createServer(async function (socket) {
            const client = socket.remoteAddress + ':' + socket.remotePort;

            // Avoid printing connection-related events, pollutes the terminal
            // logger.info({ event: 'connect', client });

            let chunkCounter = 0;
            let geninterval;
            geninterval = setInterval(() => {
                const dataToSend = getNextChunk(chunkCounter++);
                socket.write(dataToSend);
                logger.info(
                    { event: 'response', client },
                    `Sent ${dataToSend.length} bytes`
                );
            }, 1);

            socket.on('data', function (data) {
                logger.info(
                    { event: 'data', client },
                    `Received ${data.length} bytes (discarded)`
                );
            });

            socket.on('end', function () {
                // Avoid printing connection-related events, pollutes the terminal
                // logger.info({ event: 'disconnect', client });
                clearInterval(geninterval);
            });

            socket.on('timeout', function () {
                // Avoid printing connection-related events, pollutes the terminal
                // logger.error({ event: 'timeout', client });
                socket.end();
            });

            socket.on('error', function () {
                // Avoid printing connection-related events, pollutes the terminal
                // logger.error({ event: 'reset', client }, err.message);
                clearInterval(geninterval);
            });
        })
        .listen(port, host, () => {
            logger.print('[+] Protocol: "chargen"', 'yellow');
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

function startDaytimeServer(host, port) {
    const getDaytimeString = () => {
        let date = new Date();
        return (
            date.toLocaleDateString('en-us', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            }) +
            ' ' +
            date.toLocaleTimeString('pt-br', {
                timeZoneName: 'short',
            })
        );
    };

    return net
        .createServer(function (socket) {
            const client = socket.remoteAddress + ':' + socket.remotePort;
            socket.on('data', function (data) {
                logger.info(
                    { event: 'data', client },
                    `Received ${data.length} bytes (discarded)`
                );
            });

            socket.on('end', function () {
                // Avoid printing connection-related events, pollutes the terminal
                // logger.info({ event: 'disconnect', client });
            });

            socket.on('timeout', function () {
                // Avoid printing connection-related events, pollutes the terminal
                // logger.error({ event: 'timeout', client });
                socket.end();
            });

            socket.on('error', function () {
                // Avoid printing connection-related events, pollutes the terminal
                // logger.error({ event: 'reset', client }, err.message);
            });

            // Avoid printing connection-related events, pollutes the terminal
            // logger.info({ event: 'connect', client });

            const dataToSend = getDaytimeString();
            socket.write(dataToSend, err => {
                if (err) {
                    // Avoid printing connection-related events, pollutes the terminal
                    // logger.error({ event: 'reset', client }, err.message);
                } else {
                    logger.info(
                        { event: 'response', client },
                        `Sent ${dataToSend.length} bytes`
                    );
                    socket.end();
                }
            });
        })
        .listen(port, host, () => {
            logger.print('[+] Protocol: "daytime"', 'yellow');
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

function startDiscardServer(host, port) {
    return net
        .createServer(function (socket) {
            const client = socket.remoteAddress + ':' + socket.remotePort;

            // Avoid printing connection-related events, pollutes the terminal
            // logger.info({ event: 'connect', client });

            socket.on('data', function (data) {
                logger.info(
                    { event: 'data', client },
                    `Received ${data.length} bytes (discarded)`
                );
            });

            socket.on('end', function () {
                // Avoid printing connection-related events, pollutes the terminal
                // logger.info({ event: 'disconnect', client });
            });

            socket.on('timeout', function () {
                // Avoid printing connection-related events, pollutes the terminal
                // logger.error({ event: 'timeout', client });
                socket.end();
            });

            socket.on('error', function () {
                // Avoid printing connection-related events, pollutes the terminal
                // logger.error({ event: 'reset', client }, err.message);
            });
        })
        .listen(port, host, () => {
            logger.print('[+] Protocol: "discard"', 'yellow');
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

function startEchoServer(host, port) {
    return net
        .createServer(function (socket) {
            const client = socket.remoteAddress + ':' + socket.remotePort;

            // Avoid printing connection-related events, pollutes the terminal
            // logger.info({ event: 'connect', client });

            socket.on('data', function (data) {
                logger.info(
                    { event: 'data', client },
                    `Received ${data.length} bytes (echoed)`
                );
                socket.write(data);
                logger.info(
                    { event: 'response', client },
                    `Sent ${data.length} bytes (echoed)`
                );
            });

            socket.on('end', function () {
                // Avoid printing connection-related events, pollutes the terminal
                // logger.info({ event: 'disconnect', client });
            });

            socket.on('timeout', function () {
                // Avoid printing connection-related events, pollutes the terminal
                // logger.error({ event: 'timeout', client });
                socket.end();
            });

            socket.on('error', function () {
                // Avoid printing connection-related events, pollutes the terminal
                // logger.info({ event: 'reset', client }, err.message);
            });
        })
        .listen(port, host, () => {
            logger.print('[+] Protocol: "echo"', 'yellow');
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
    const help = `
    [server-simptcp-js]
        A tool for creating and running the Simple-TCP/IP services (chargen/daytime/discard/echo)

    Usage:
        server-simptcp <service> [--help] [--port PORT] [--host HOST]

    Options:
        --help    | -h  : Shows this help menu
        --version | -v  : Shows version information
        --port    | -p  : Selects a port to use (defaults vary)
        --host    | -o  : Selects an interface to use (default is '0.0.0.0')
        --no-color      : Disable the colorful output

    Services and Default Ports:
    ┌──────────────────────────────────────────────────────────────────────┐
    │  Service:      Port:      Comment:                                   │
    ├──────────────────────────────────────────────────────────────────────┤
    │  chargen       19         Generates an endless character stream      │
    │  daytime       13         Discards input and outputs current date    │
    │  discard       9          Simply discards all input                  │
    │  echo          7          Outputs the received input                 │
    └──────────────────────────────────────────────────────────────────────┘`;

    const SERVICES = {
        chargen: { port: 19, create: startChargenServer },
        daytime: { port: 13, create: startDaytimeServer },
        discard: { port: 9, create: startDiscardServer },
        echo: { port: 7, create: startEchoServer },
    };

    const context = {
        host: '0.0.0.0',
        protocol: '',
        port: null,
    };

    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('port', { alias: 'p', allowCasting: true });
    parser.option('host', { alias: 'o' });
    parser.option('no-color', { allowValue: false });
    parser.argument('protocol');
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || !args.protocol) return console.log(help);

    if (args._invalid.length > 0)
        return console.log(
            `[x] Error: invalid parameters [ ${args._invalid.join(', ')} ]`
        );

    if (args.port) context.port = args.port;
    if (args.host) context.host = args.host;
    if (args['no-color']) logger.disableColors();

    try {
        if (!Object.keys(SERVICES).includes(args.protocol)) {
            logger.print(
                'Invalid service [' +
                    args.protocol +
                    ']. Use --help or -h for the help page.',
                'red'
            );
            process.exit();
        }

        if (!context.port) context.port = SERVICES[args.protocol].port;

        SERVICES[args.protocol].create(context.host, context.port);
    } catch (err) {
        logger.print('Server Fatal Error: ' + err.message, 'red');
        process.exit(1);
    }
})();
