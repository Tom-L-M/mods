const fs = require('fs');
const net = require('net');
const readline = require('readline');
const { ArgvParser } = require('../shared');

const help = `
    [net-cat-js]
        A tool for creating live-sending TCP connections to remote hosts

    Usage:
        net-cat <host> <port> [options]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -p | --pipe X       All the output and input in the console will be
                            copied to a file.
        -s | --silent       The console output will be suppressed. This does
                            not interfere with --pipe. This does not supress 
                            the user input on the screen, only the terminal output`;

(function () {
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('silent', { alias: 's', allowValue: false });
    parser.option('pipe', { alias: 'p' });
    parser.argument('host');
    parser.argument('port');
    const args = parser.parseArgv();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || !args.host || !args.port) return console.log(help);
    if (args.silent) args.silent = true;
    if (args.pipe) {
        if (!fs.existsSync(args.pipe)) {
            try {
                fs.writeFileSync(args.pipe, '');
                let str = `<> Created file - piping dual output to ${args.pipe}`;
                if (!args.silent) console.log(str);
                if (args.pipe) {
                    fs.appendFileSync(args.pipe, str + '\n');
                }
            } catch {
                args.pipe = false;
                if (!args.silent)
                    console.log(
                        `<> Error: Impossible to write to file: ${args.pipe}`
                    );
            }
        } else {
            let str = `<> Piping dual output to ${args.pipe}\n`;
            if (!args.silent) console.log(str);
            if (args.pipe) {
                fs.appendFileSync(args.pipe, str + '\n');
            }
        }
    }

    let socket;
    try {
        socket = net.createConnection(
            { host: args.host, port: args.port },
            () => {
                let str1 = `<> Connected to ${args.host}:${args.port}`;
                let str2 = `<> Write '<exit>' at any time to exit the program and close the connection\n`;
                if (!args.silent) console.log(str1);
                if (!args.silent) console.log(str2);
            }
        );
    } catch {
        let str =
            '<> Error while creating connection. Use --help for the help menu.';
        if (!args.silent) console.log(str);
        return;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
    });

    rl.on('line', line => {
        if (line.trim() == 'exit') return socket.end();
        if (args.pipe) {
            fs.appendFileSync(args.pipe, line + '\n');
        }
        socket.write(line + '\n');
    });

    socket.on('data', data => {
        if (args.pipe) {
            fs.appendFileSync(args.pipe, data + '\n');
        }
        if (!args.silent) console.log(data + '\n');
    });
    socket.on('error', err => {
        if (args.pipe) {
            fs.appendFileSync(args.pipe, err + '\n');
        }
        socket.destroy();
        rl.close();
    });
    socket.on('end', () => {
        let str = `<> Disconnected from ${args.host}:${args.port}`;
        if (!args.silent) console.log(str);
        // process.exit(0);
        rl.close();
    });
})();
