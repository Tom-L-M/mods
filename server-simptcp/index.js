const net = require('net');

function log(protocol, host, port, rHost, rPort, event) {
    return console.log(
        `${new Date().toISOString()} tcp ${protocol} - ${host}:${port} <> ${rHost}:${rPort} - ${event}`
    );
}

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
            let socketOld = {
                remoteAddress: socket.remoteAddress,
                remotePort: socket.remotePort,
            };
            let chunkCounter = 0;
            let geninterval;
            geninterval = setInterval(() => {
                const dataToSend = getNextChunk(chunkCounter++);
                socket.write(dataToSend);
                log(
                    'echo',
                    host,
                    port,
                    socket.remoteAddress,
                    socket.remotePort,
                    `DATA_OUT (${
                        dataToSend.length
                    } bytes) - ${dataToSend.trim()}`
                );
            }, 1);

            log(
                'chargen',
                host,
                port,
                socket.remoteAddress,
                socket.remotePort,
                'CONNECT'
            );

            socket.on('data', function (data) {
                log(
                    'chargen',
                    host,
                    port,
                    socket.remoteAddress,
                    socket.remotePort,
                    `DATA_IN (${data.length} bytes) - DISCARDED`
                );
            });

            socket.on('end', function () {
                log(
                    'chargen',
                    host,
                    port,
                    socketOld.remoteAddress,
                    socketOld.remotePort,
                    `DISCONNECT`
                );
                clearInterval(geninterval);
            });

            socket.on('timeout', function () {
                log(
                    'chargen',
                    host,
                    port,
                    socket.remoteAddress,
                    socket.remotePort,
                    `TIMEOUT`
                );
                socket.end();
            });

            socket.on('error', function (err) {
                log(
                    'chargen',
                    host,
                    port,
                    socket.remoteAddress,
                    socket.remotePort,
                    `RESET -> ERR:${err.message}`
                );
                clearInterval(geninterval);
            });
        })
        .listen(port, host, () => {
            console.log(`>> Chargen server running on tcp://${host}:${port}`);
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
            let socketOld = {
                remoteAddress: socket.remoteAddress,
                remotePort: socket.remotePort,
            };

            socket.on('data', function (data) {
                log(
                    'daytime',
                    host,
                    port,
                    socket.remoteAddress,
                    socket.remotePort,
                    `DATA_IN (${data.length} bytes) - DISCARDED`
                );
            });

            socket.on('end', function (hadError) {
                log(
                    'daytime',
                    host,
                    port,
                    socketOld.remoteAddress,
                    socketOld.remotePort,
                    `DISCONNECT`
                );
            });

            socket.on('timeout', function () {
                log(
                    'daytime',
                    host,
                    port,
                    socket.remoteAddress,
                    socket.remotePort,
                    `TIMEOUT`
                );
                socket.end();
            });

            socket.on('error', function (err) {
                log(
                    'daytime',
                    host,
                    port,
                    socket.remoteAddress,
                    socket.remotePort,
                    `RESET -> ERR:${err.message}`
                );
            });

            log(
                'daytime',
                host,
                port,
                socket.remoteAddress,
                socket.remotePort,
                'CONNECT'
            );
            const dataToSend = getDaytimeString();
            socket.write(dataToSend, err => {
                if (err) {
                    log(
                        'daytime',
                        host,
                        port,
                        socket.remoteAddress,
                        socket.remotePort,
                        `RESET -> ERR:${err.message}`
                    );
                } else {
                    log(
                        'daytime',
                        host,
                        port,
                        socket.remoteAddress,
                        socket.remotePort,
                        `DATA_OUT (${dataToSend.length} bytes) - ${dataToSend}`
                    );
                    socket.end();
                }
            });
        })
        .listen(port, host, () => {
            console.log(`>> Daytime server running on tcp://${host}:${port}`);
        });
}

function startDiscardServer(host, port) {
    return net
        .createServer(function (socket) {
            let socketOld = {
                remoteAddress: socket.remoteAddress,
                remotePort: socket.remotePort,
            };

            log(
                'discard',
                host,
                port,
                socket.remoteAddress,
                socket.remotePort,
                'CONNECT'
            );

            socket.on('data', function (data) {
                log(
                    'discard',
                    host,
                    port,
                    socket.remoteAddress,
                    socket.remotePort,
                    `DATA_IN (${data.length} bytes) - DISCARDED`
                );
            });

            socket.on('end', function (socket) {
                log(
                    'discard',
                    host,
                    port,
                    socketOld.remoteAddress,
                    socketOld.remotePort,
                    `DISCONNECT`
                );
            });

            socket.on('timeout', function () {
                log(
                    'discard',
                    host,
                    port,
                    socket.remoteAddress,
                    socket.remotePort,
                    `TIMEOUT`
                );
                socket.end();
            });

            socket.on('error', function (err) {
                log(
                    'discard',
                    host,
                    port,
                    socket.remoteAddress,
                    socket.remotePort,
                    `RESET -> ERR:${err.message}`
                );
            });
        })
        .listen(port, host, () => {
            console.log(`>> Discard server running on tcp://${host}:${port}`);
        });
}

function startEchoServer(host, port) {
    return net
        .createServer(function (socket) {
            let socketOld = {
                remoteAddress: socket.remoteAddress,
                remotePort: socket.remotePort,
            };

            log(
                'echo',
                host,
                port,
                socket.remoteAddress,
                socket.remotePort,
                'CONNECT'
            );

            socket.on('data', function (data) {
                log(
                    'echo',
                    host,
                    port,
                    socket.remoteAddress,
                    socket.remotePort,
                    `DATA_IN (${data.length} bytes) - ${data.toString().trim()}`
                );
                socket.write(data);
                log(
                    'echo',
                    host,
                    port,
                    socket.remoteAddress,
                    socket.remotePort,
                    `DATA_OUT (${data.length} bytes) - ECHOED`
                );
            });

            socket.on('end', function () {
                log(
                    'echo',
                    host,
                    port,
                    socketOld.remoteAddress,
                    socketOld.remotePort,
                    `DISCONNECT`
                );
            });

            socket.on('timeout', function () {
                log(
                    'echo',
                    host,
                    port,
                    socket.remoteAddress,
                    socket.remotePort,
                    `TIMEOUT`
                );
                socket.end();
            });

            socket.on('error', function (err) {
                log(
                    'echo',
                    host,
                    port,
                    socket.remoteAddress,
                    socket.remotePort,
                    `RESET -> ERR:${err.message}`
                );
            });
        })
        .listen(port, host, () => {
            console.log(`>> Echo server running on tcp://${host}:${port}`);
        });
}

const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

function printVersion() {
    try {
        console.log(require(exeresolve('server-simptcp/package.json')).version);
    } catch (err) {
        console.log('Error: could not read package descriptor.');
    }
}

(function wrapper() {
    const args = process.argv.slice(2);

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
        args: args,
        help: help,
        host: '0.0.0.0',
        protocol: (args[0] || '').toLowerCase(),
        port: null,
    };

    for (let i = 0; i < args.length; i++) {
        let arg = args[i];
        let next = args[i + 1];

        switch (arg) {
            case '-h':
            case '--help':
                return console.log(help);
            case '-v':
            case '--version':
                return printVersion();
            case '-o':
            case '--host':
                context.host = next;
                i++;
                break;
            case '-p':
            case '--port':
                context.port = next;
                i++;
                break;
            default:
        }
    }

    try {
        if (!context.protocol) {
            return console.log(help);
        } else if (!Object.keys(SERVICES).includes(context.protocol)) {
            throw new Error(
                'Invalid service [' +
                    context.protocol +
                    ']. Use --help or -h for the help page.'
            );
        }

        if (!context.port) context.port = SERVICES[context.protocol].port;

        SERVICES[context.protocol].create(context.host, context.port);
    } catch (err) {
        console.log('<> Error: ' + err.message);
    }
})();
