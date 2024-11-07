const net = require('net');
const readline = require('readline');
const fs = require('fs');

const _require = file => {
    const fname = process.env.MODULE_NAME + '/' + file;
    const fdirname = __dirname.replaceAll('\\', '/');
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    const final = fdirname.endsWith(m0)
        ? fdirname + '/' + m1
        : fdirname + '/' + fname;
    return require(final);
};

function printVersion() {
    try {
        console.log(_require('package.json').version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

(function main() {
    const args = process.argv.slice(2);
    const targetAddress = args[0];
    const targetPort = args[1];
    const help = `
    [net-cat-js]
        A tool for creating live-sending TCP connections to remote hosts

    Usage:
        net-cat <host> <port> [options]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -f | --file X       All the output and input in the console will be
                            copied to a file.
        -s | --silent       The console output will be suppressed. This does
                            not interfere with --pipe. This does not supress 
                            the user input on the screen, only the terminal output
`;
    let pipeto = false;
    let isSilent = false;
    if (args.includes('--help') || args.includes('-h') || args.length < 2)
        return console.log(help);
    if (args.includes('--version') || args.includes('-v'))
        return printVersion();

    if (args.includes('--silent')) isSilent = true;
    if (args.includes('--pipe')) {
        pipeto = args[args.indexOf('--pipe') + 1];
        if (!fs.existsSync(pipeto)) {
            try {
                fs.writeFileSync(pipeto, '');
                let str = `<> Created file - piping dual output to ${pipeto}`;
                if (!isSilent) console.log(str);
                if (pipeto) {
                    fs.appendFileSync(pipeto, str + '\n');
                }
            } catch {
                pipeto = false;
                if (!isSilent)
                    console.log(
                        `<> Error: Impossible to write to file: ${pipeto}`
                    );
            }
        } else {
            let str = `<> Piping dual output to ${pipeto}\n`;
            if (!isSilent) console.log(str);
            if (pipeto) {
                fs.appendFileSync(pipeto, str + '\n');
            }
        }
    }

    let socket;
    try {
        socket = net.createConnection(
            { host: targetAddress, port: targetPort },
            () => {
                let str1 = `<> Connected to ${targetAddress}:${targetPort}`;
                let str2 = `<> Write '<exit>' at any time to exit the program and close the connection\n`;
                if (!isSilent) console.log(str1);
                if (!isSilent) console.log(str2);
            }
        );
    } catch {
        let str =
            '<> Error while creating connection. Use --help for the help menu.';
        if (!isSilent) console.log(str);
        return;
    }

    socket.on('data', data => {
        if (pipeto) {
            fs.appendFileSync(pipeto, data + '\n');
        }
        if (!isSilent) console.log(data + '\n');
    });
    socket.on('error', err => {
        if (pipeto) {
            fs.appendFileSync(pipeto, err + '\n');
        }
        if (!isSilent) console.log(err);
        socket.destroy();
    });
    socket.on('end', () => {
        let str = `<> Disconnected from ${targetAddress}:${targetPort}`;
        if (!isSilent) console.log(str);
        process.exit(0);
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
    });
    rl.on('line', line => {
        if (line.trim() == 'exit') return socket.end();
        if (pipeto) {
            fs.appendFileSync(pipeto, line + '\n');
        }
        socket.write(line + '\n');
    });
})();
