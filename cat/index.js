const fs = require('fs');
const { ArgvParser, isStdinActive, readStdin } = require('../shared');

function streamToSTDOUT(fname) {
    return new Promise((resolve, reject) => {
        try {
            const stream = fs.createReadStream(fname);
            stream.pipe(process.stdout);
            stream.on('end', resolve);
        } catch (err) {
            reject(err);
        }
    });
}

const help = `
    [cat-js]
        A "cat" command line utility in NodeJS.

    Usage:
        node cat [options] [...files]
        <stdin> | node cat [options] [-] [...files]

    Options:        
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -f | --file-list        Interprets STDIN as a list of files instead of data.
                                Files in list should be separated by newlines.
        -s | --separator N      Writes a separator after each item added (if more than 1).

    Info:
        When providing data from STDIN, it will be placed at position of '-'.
        Or, if no '-' is provided, and STDIN has data, it will be appended first.

    Examples:
        cat something.txt                   # Read file and prints to STDOUT.
        cat somefile.txt otherfile.txt      # Concats the 2 files and print.
        cat a.txt | cat b.txt               # Reads a.txt and concat with b.txt.
        cat a.txt b.txt                     # Also reads a.txt and concat with b.txt.
        ls | cat a.txt - b.txt              # Concats: a.txt + (result of ls) + b.txt.
        ls | cat a.txt - b.txt              # Concats: (result of ls) + a.txt + b.txt.
        dir /B /A-D | cat -f -              # Concats all files from current cwd`;

(async function () {
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('file-list', { alias: 'f', allowValue: false });
    parser.option('separator', { alias: 's' });
    const args = parser.parseArgv();
    const files = args._;

    const stdinActive = isStdinActive();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!files.length && !stdinActive)) return console.log(help);

    // If no STDIN output token is used, append to the end
    if (stdinActive && !files.includes('-')) files.unshift('-');

    const separator = typeof args.separator === 'string' ? args.separator : '';

    let file,
        stdindata = stdinActive ? await readStdin() : '';
    try {
        for (let i = 0; i < files.length; i++) {
            file = files[i];
            if (file === '-') {
                if (!stdinActive) continue;
                // If the '-f' modifier is used, interpret STDIN as a file list
                if (args['file-list']) {
                    let filelist = stdindata
                        .toString()
                        .split('\n')
                        .map(v => v.trim())
                        .filter(v => !!v);

                    for (let subfile of filelist)
                        try {
                            if (i > 0) process.stdout.write(separator);
                            await streamToSTDOUT(subfile);
                        } catch (err) {
                            return console.log(
                                `Error: Could not read file from STDIN "${subfile}" (${err.message})`
                            );
                        }
                } else {
                    if (i > 0) process.stdout.write(separator);
                    process.stdout.write(stdindata);
                }
            } else {
                if (i > 0) process.stdout.write(separator);
                await streamToSTDOUT(file);
            }
        }
    } catch (err) {
        return console.log(
            `Error: Could not read file "${file}" (${err.message})`
        );
    }
})();
