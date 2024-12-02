const fs = require('fs');
const { ArgvParser, isSTDINActive, readStdinAsync } = require('../shared');

const help = `
    [diff-js]
        A "diff" command line utility in NodeJS.

    Usage:
        node diff [options] [file-A] [file-B] 
      OR
        <stdin> | node diff [options] [file-B] 
        
    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -q | --quiet            Shows only if the files are different or not.
        -C | --no-color         Prints result without color ANSI tokens.`;

const green = string => `\x1b[32m${string}\x1b[0m`;
const red = string => `\x1b[31m${string}\x1b[0m`;

/**
 * Generates a new Modification patch array from two data sources using Myer's Diff Algorithm.
 * @param {string|Array<string>} source The data to compare as 'source'. May be a string, buffer or array.
 * @param {string|Array<string>} destinatin The data to compare as 'destination'. May be a string, buffer or array.
 * @returns {Array<{action:string,data:string}>} A list of "new Modification" objects, representing the steps needed to build the patch.
 */
function diff(source, destination) {
    class Modification {
        constructor(action, data) {
            this.action = action;
            this.data = data;
        }
    }

    let frontier = { 1: { x: 0, history: [] } };
    let aMax = source.length;
    let bMax = destination.length;

    for (let d = 0; d <= aMax + bMax; d++) {
        for (let k = -d; k <= d; k += 2) {
            let goDown =
                k === -d || (k !== d && frontier[k - 1].x < frontier[k + 1].x);

            let oldX, history;
            if (goDown) {
                oldX = frontier[k + 1].x;
                history = frontier[k + 1].history;
            } else {
                oldX = frontier[k - 1].x + 1;
                history = frontier[k - 1].history;
            }

            history = history.slice();
            let y = oldX - k;

            if (1 <= y && y <= bMax && goDown) {
                history.push(new Modification('insert', destination[y - 1]));
            } else if (1 <= oldX && oldX <= aMax) {
                history.push(new Modification('remove', source[oldX - 1]));
            }

            while (oldX < aMax && y < bMax && source[oldX] === destination[y]) {
                oldX++;
                y++;
                history.push(new Modification('keep', source[oldX - 1]));
            }

            if (oldX >= aMax && y >= bMax) {
                return history;
            } else {
                frontier[k] = { x: oldX, history };
            }
        }
    }

    throw new Error('Could not find edit script');
}

function splitInLines(data, { replaceCRLF = false } = {}) {
    if (replaceCRLF) data = data.replaceAll('\r\n', '\n');
    return data.split('\n');
}

function patch(data1, data2, { quiet, nocolor } = {}) {
    const dataSource1 = splitInLines(data1, { replaceCRLF: true }); //data1.trim().split('\n');
    const dataSource2 = splitInLines(data2, { replaceCRLF: true }); //data2.trim().split('\n');
    const difflist = diff(dataSource1, dataSource2);

    if (quiet) {
        return console.log(difflist.length > 0);
    }

    for (let { action, data } of difflist) {
        if (action === 'insert') {
            console.log('+ ' + (nocolor ? data : green(data)));
        } else if (action === 'remove') {
            console.log('- ' + (nocolor ? data : red(data)));
        } else {
            console.log('  ' + data);
        }
    }
}

(async function () {
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('quiet', { alias: 'q', allowValue: false });
    parser.option('no-color', { alias: 'C', allowValue: false });
    const args = parser.parseArgv();
    const file = args._[0];
    const fileB = args._[1];

    const fromSTDIN = isSTDINActive();
    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || (!fromSTDIN && !file)) return console.log(help);

    let input, inputB;
    const quiet = args.quiet || null;
    const nocolor = args['no-color'] || null;

    // If it is called like:    node script.js [somefile] [somefileB] [flags]
    // E.g. there is no input via pipes
    if (!fromSTDIN) {
        try {
            input = fs.readFileSync(file);
        } catch {
            return console.log(`Error: Could not read file ${file}`);
        }
        try {
            inputB = fs.readFileSync(fileB);
        } catch {
            return console.log(`Error: Could not read file ${fileB}`);
        }
    }

    // If it is called like:   cat somefile | node script.js [somefileB] [flags]
    // E.g. there is input via pipes
    else {
        input = await readStdinAsync();
        try {
            inputB = fs.readFileSync(file);
        } catch {
            return console.log(`Error: Could not read file ${file}`);
        }
    }

    return patch(input.toString(), inputB.toString(), {
        quiet,
        nocolor,
    });
})();
