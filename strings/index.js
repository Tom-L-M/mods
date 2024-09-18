// const fs = require('fs');

// (function main () {
//     // strings <file> [--min-size size] [--search search] [--ni] [--raw]
//     let regsz = ""; // holds the fixed length of the string (if it exists)
//     let reg = "[A-Za-z0-9!@#$%&*()_+-=&?:;'áÁàÀäÄâÂãÃéÉèÈëËêÊíÍìÌïÏîÎóÓòÒöÖôÔõÕúÚùÙüÜûÛ]"; // holds the whole regexp
//     let regExp;
//     let strings;
//     let result;
//     let flags;
//     const args = process.argv.slice(2);
//     const file = args[0];
//     const fixedLen = args.includes('--min-size');
//     const fixedWrd = args.includes('--search');
//     const caseSensitive = args.includes('--ni');
//     const isRaw = args.includes('--raw');

//     const help = `
//     [strings-js]
//         A tool to search for strings in a file.

//     Usage:
//         sstrings <file> [--min-size *] [--search *] [--ni] [--raw]

//     Info:
//         > Using '--min-size' you can specify a minimum string length to search for.
//             > Usage:    sstring example.txt --min-size 6    // searches for strings with min length 6
//         > Using '--search' you can search for a specific string.
//             > Usage:    sstring example.txt --search "hello 123"   // searches for the string "hello 123"
//         > Using: '--ni', you can search for a specific word in case-sensitive mode (default is case-sensitive)
//             > Usage:    sstring example.txt --search hello --ni     // searches for any case combination of 'hello'
//         > Using: '--raw', you can return the result without color special characters. Useful only if you intend to
//           dump the result to a file.

//         > Not using '--search', causes the program to dump all strings found in the file.
//           Useful for string dumping in binary files.
//     `;

//     if (args.length < 1 || args.includes('--help')) return console.log(help);
//     flags = (caseSensitive ? 'gim' : 'gm');

//     if (fixedLen) {
//         regsz = '{' + (Number(args[args.indexOf('--min-size')+1]) || 5) + ',}';
//         reg = reg + regsz;
//     }

//     if (fixedWrd) reg = (args[args.indexOf('--search')+1] || false) + regsz;

//     try {
//         strings = fs.readFileSync(file, 'utf-8');
//     } catch (err) {
//         console.log(err);
//         return console.log('Error: Impossible to read file');
//     }

//     regExp = new RegExp(reg,flags);
//     console.log('<> Searching for: ', regExp);

//     strings = strings.split('\n').map((x) => {
//         let m = x.match(regExp);
//         if (m && m.length > 0) {
//             if (!isRaw && !reg.includes("[A-Za-z0-9!@#$%&*()_+-=")) return x.replace(regExp, '\x1b[31m'+reg.toLowerCase()+'\x1b[0m');
//             else return x;
//         } else {
//             return '';
//         }
//     }).filter(x => !!x).join('\n');

//     return console.log(strings);
// })();

const fs = require('fs');

const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

function printVersion() {
    try {
        console.log(require(exeresolve('strings/package.json')).version);
    } catch (err) {
        console.log('Error: could not read package descriptor.');
    }
}

(function main() {
    const help = `
    [strings-js]
        A tool to search for strings in a file

    Usage:
        strings <file> [-h|--help] [-v|--version] [--search|-s X] [--case-sensitive|-c] [--raw|-r] [--min-size|-i] [--max-size|-a]

    Info:
        > Using: '-s or --search' you can search for a specific string instead of dumping all strings
        > Using: '-c or --case-sensitive', you can search for a specific word in case-sensitive mode
        > Using: '-a or --max-size', you can define the maximum number of chars in a string to look for
        > Using: '-i or --min-size', you can define the minimum number of chars in a string to look for
        > Using: '-r or --raw', you can return the result without color special characters
            (Useful only if you intend to dump the result to a file)`;

    function buildFilter({ caseSensitive, search, min, max }) {
        let pattern = search ? `${search}[\\s\\w]{0,}` : '[\\s\\w]+';
        let flags = caseSensitive ? 'gm' : 'gim';
        let regexp = new RegExp(pattern, flags);
        return {
            pattern: pattern,
            regexp: regexp,
            exec: function (str) {
                let matches = str.match(regexp) || [];
                if (min) matches = matches.filter(match => match.length >= min);
                if (max) matches = matches.filter(match => match.length <= max);
                return matches;
            },
        };
    }

    const args = process.argv.slice(2);
    if (args.length < 1 || args.includes('--help') || args.includes('-h'))
        return console.log(help);
    if (args.includes('--version') || args.includes('-v'))
        return printVersion();

    let strings = '';
    const file = args[0];
    const context = {
        search: false,
        raw: false,
        caseSensitive: false,
        min: '',
        max: '',
        json: false,
    };

    for (let i = 1; i < args.length; i++) {
        let current = args[i];
        let next = args[i + 1];
        switch (current) {
            case '--json':
            case '-j':
                context.json = true;
                break;

            case '--raw':
            case '-r':
                context.raw = true;
                break;

            case '--case-sensitive':
            case '-c':
                context.caseSensitive = true;
                break;

            case '--search':
            case '-s':
                context.search = next;
                break;

            case '--min-size':
            case '-i':
                context.min = parseInt(next);
                break;

            case '--max-size':
            case '-a':
                context.max = parseInt(next);
                break;
        }
    }

    try {
        strings = fs.readFileSync(file, 'utf-8');
    } catch (err) {
        return console.log('Error: Impossible to read file -', err.message);
    }

    const filter = buildFilter({
        min: context.min,
        max: context.max,
        search: context.search,
        caseSensitive: context.caseSensitive,
    });

    // console.log('<> Searching for: ', filter.regexp);

    let mat = filter.exec(strings);

    if (mat) {
        if (context.json) mat = JSON.stringify(mat, null, '\t');
        else mat = mat.join('\n');
    } else {
        if (context.json) mat = JSON.stringify([]);
        else mat = 'No items found';
    }

    console.log(mat);
})();
