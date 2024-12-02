const fs = require('fs');

(function () {
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
    if (args.includes('--version') || args.includes('-v'))
        return console.log(require('./package.json')?.version);
    if (args.length < 1 || args.includes('--help') || args.includes('-h'))
        return console.log(help);

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
