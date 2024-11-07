const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

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

const help = `
    [log-wrap-js]
        A tool for catching STDOUT from a command and creating a log file

    Usage:
        log-wrap <logdir> <logname> [options] <command>

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -q | --quiet        Supress stdout and stderr to console while still logging

    Info:
        -> Log name format is: 'LOGNAME-YEAR.MONTH.DAY-HOURS.MINUTES.SECONDS.log'
           Ex:  MyApp-2021.11.19-19h48m34s.log`;

function buildOutputFileName(appname) {
    const pad = num => String(num).padStart(2, '0');
    const now = new Date();

    const day = pad(now.getDate());
    const month = pad(now.getMonth() + 1);
    const year = now.getFullYear();

    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());

    return `${appname}-${year}.${month}.${day}-${hours}h.${minutes}m.${seconds}s.log`;
}

(async function main() {
    const argv = process.argv.slice(2);
    if (argv.length < 2) return console.log(help);
    if (argv.includes('-v') || argv.includes('--version'))
        return printVersion();

    const appname = argv[1];
    const outputdir = path.resolve(argv[0]);
    const quiet = argv.includes('-q') || argv.includes('--quiet');
    const command = argv.slice(quiet ? 3 : 2);
    const outputfile = path.join(outputdir, buildOutputFileName(appname));

    try {
        const outputstream = fs.createWriteStream(outputfile);

        await new Promise(resolve => {
            try {
                const subp = spawn(command[0], command.slice(1));
                subp.on(
                    'error',
                    err => console.log(` >> Error:`, err.message) || resolve()
                );
                subp.on('close', () => outputstream.close() || resolve());
                subp.on('spawn', () => {
                    subp.stdout.on('data', data => {
                        if (!quiet) process.stdout.write(data);
                        outputstream.write(data);
                    });
                    subp.stderr.on('data', data => {
                        if (!quiet) process.stderr.write(data);
                        outputstream.write(data);
                    });
                });
            } catch (err) {
                console.log(
                    ` >> Error: Could not spawn subprocess -`,
                    err.message
                );
                return resolve();
            }
        });
    } catch {
        console.log(
            ` >> Error: Could not create output stream to [${outputfile}]`
        );
    }
})();
