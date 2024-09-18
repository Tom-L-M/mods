const sendTcpPacket = context => {
    const { message, killconnection, keepalive, silent, empty, port, host } =
        context;
    /* message<String|Buffer>, killconnection<Boolean>, keepalive<Boolean>, silent<Boolean>, <Boolean>, empty<Boolean>, port<String|Number>, host<String> */

    const net = require('net');
    const socket = new net.Socket();

    socket.connect(port, host, function () {
        if (!silent) console.log(`> Client connected >> [tcp@${host}:${port}]`);
        let toSend = !empty ? message || '0' : Buffer.from([0]);
        socket.write(toSend);
        if (!silent) console.log(`> Data sent (${toSend.length} bytes)`);
    });

    socket.on('data', function (data) {
        if (!silent)
            console.log(`> Data received (${data.length} bytes) \n  ` + data);
        if (killconnection)
            socket.destroy(); // kills socket after server's response
        else if (keepalive /* hangs and waits for the user to close it */);
        else socket.end(); // closes socket gracefully after server's response
    });

    socket.on('error', function (data) {
        console.log(`> Error triggered \n  ` + data);
        // if (killconnection) socket.destroy(); // kills socket after server's response
        // else if (keepalive) ;/* hangs and waits for the user to close it */
        // else socket.end(); // closes socket gracefully after server's response
    });

    socket.on('close', function () {
        if (!silent)
            console.log(`> Client disconnected >> [tcp@${host}:${port}]`);
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
        console.log(require(exeresolve('client-tcp/package.json')).version);
    } catch (err) {
        console.log('Error: could not read package descriptor.');
    }
}

(function _wrapper() {
    const args = process.argv.slice(2);

    const help = `
    [client-tcp-js]
        A tool for sending TCP packets for servers and services

    Usage:
        client-tcp <targetHost> <targetPort> [options]

    Options:
        -h | --help                Prints the help message and quits.
        -v | --version             Prints the version info and quits.
        -s | --silent              Prevents response logging in the terminal
        -a | --keep-alive          Keeps connection alive
        -k | --kill-connection     Ends connection immediately (stealth - don't wait for response)
        -e | --empty               Sends an empty packet - no data
        -t | --text TEXT           Sends a specific text as data in packet
        -b | --bytes BYTES         Sends a specific series of hex bytes as data in packet
        -f | --file FILENAME       Reads a file and sends its contents as data

    Example:
        client-tcp 127.0.0.1 8080 --bytes "73 6f 6d 65 63 6f 6e 74 65 6e 74"
        client-tcp 127.0.0.1 8080 --text "some text" --keep-alive`;

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
        killconnection: false,
        keepalive: false,
        message: '0',
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
                context.message = Buffer.from(
                    args[++i].split(' ').map(v => parseInt(v, 16))
                );
                break;

            case '-f':
            case '--file': // --file "./example/file.bin"
                const fs = require('fs');
                context.message = fs.readFileSync(args[++i]);
                break;

            case '-a':
            case '--keep-alive':
                context.keepalive = true;
                break;

            case '-k':
            case '--kill-connection':
                context.killconnection = true;
                break;

            case '-nl':
            case '--no-log':
                context.silent = true;
                break;

            case '-e':
            case '--empty':
                context.empty = true;
                break;
        }
    }

    sendTcpPacket(context);
})();
