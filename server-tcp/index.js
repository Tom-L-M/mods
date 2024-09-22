function startTcpServer(context) {
    const net = require('net');
    const { host, port, content } = context;
    return net
        .createServer(function (socket) {
            let date = new Date();
            let now =
                date.toString().split(' ')[4] +
                '.' +
                date.getMilliseconds().toString().padStart(3, '0');
            console.log(
                `\n> ${now} > Connected: tcp@${host}:${port} <> tcp@${socket.remoteAddress}:${socket.remotePort}`
            );
            socket.on('data', function (data) {
                let date = new Date();
                let now =
                    date.toString().split(' ')[4] +
                    '.' +
                    date.getMilliseconds().toString().padStart(3, '0');
                console.log(
                    `> ${now} > Received data (${data.length} bytes) \n  ${data}`
                );
                socket.write(content);
            });
            socket.on('close', function (data) {
                let date = new Date();
                let now =
                    date.toString().split(' ')[4] +
                    '.' +
                    date.getMilliseconds().toString().padStart(3, '0');
                console.log(
                    `> ${now} > Disconnected: tcp@${host}:${port} <> tcp@${socket.remoteAddress}:${socket.remotePort}`
                );
            });
            socket.on('error', function (err) {
                let date = new Date();
                let now =
                    date.toString().split(' ')[4] +
                    '.' +
                    date.getMilliseconds().toString().padStart(3, '0');
                console.log(
                    `> ${now} > Connection failed: tcp@${host}:${port} <> tcp@${socket.remoteAddress}:${socket.remotePort} -> ${err.message}`
                );
            });
        })
        .listen(port, host, () => {
            console.log(
                '>> Automatic config used. Use --help to access the help menu.'
            );
            console.log(`>> TCP server running on tcp://${host}:${port}/`);
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
        console.log(require(exeresolve('server-tcp/package.json')).version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
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
                return printVersion();

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
        if (!context.content) context.content = '<TCP/>';
        startTcpServer(context);
    } catch (err) {
        console.log(err.message);
    }
})();
