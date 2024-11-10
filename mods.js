function murmurHash(key, seed = 0) {
    const C = { M: 0x5bd1e995, R: 0x18 };
    const im32M = a => {
        const c = { o: v => v & 0xffff, i: v => (v >>> 16) & 0xffff };
        return (
            c.o(a) * 59797 + (((c.i(a) * 59797 + c.o(a) * 23505) << 16) >>> 0)
        );
    };

    let len = key.length;
    let h = seed ^ len;
    let i = 0;
    let k = 0;

    while (len >= 4) {
        k = key[i++] | (key[i++] << 8) | (key[i++] << 16) | (key[i++] << 24);
        k = im32M(k);
        k ^= k >>> C.R;
        k = im32M(k);
        h = im32M(h) ^ k;
        len -= 4;
    }

    switch (len) {
        case 3:
            h ^= key[i + 2] << 16;
        case 2:
            h ^= key[i + 1] << 8;
        case 1:
            h ^= key[i];
            h = im32M(h);
    }

    h ^= h >>> 13;
    h = im32M(h);
    h ^= h >>> 15;
    return h >>> 0;
}

function diceCoefficient(value, other, ngram_size = 2) {
    function chunk(n, value) {
        const nGrams = [];
        if (value === null || value === undefined) return nGrams;
        const source =
            typeof value.slice === 'function' ? value : String(value);
        let index = source.length - n + 1;
        if (index < 1) return nGrams;
        while (index--) nGrams[index] = source.slice(index, index + n);
        return nGrams;
    }
    const left = chunk(ngram_size, value.toLowerCase());
    const right = chunk(ngram_size, other.toLowerCase());
    let index = -1;
    let intersections = 0;
    while (++index < left.length) {
        const leftPair = left[index];
        let offset = -1;
        while (++offset < right.length) {
            const rightPair = right[offset];

            if (leftPair === rightPair) {
                intersections++;

                // Make sure this pair never matches again.
                right[offset] = '';
                break;
            }
        }
    }
    return (2 * intersections) / (left.length + right.length);
}

// Formats a list to group in columns and add a token (like '>') before each item
const formatVerticalList = arr => {
    const MAX_CHARS_PER_NAME = 20;
    const ITEM_NAME_POINTERS = '~';
    const SPACE_BETWEEN_COLS = '\t ';
    // number of columns varies depending on number of items in list
    // const COLS = arr.length > 7 ? 4 : 2;
    const COLS =
        arr.length > 15 ? 4 : arr.length > 10 ? 3 : arr.length > 5 ? 2 : 1;
    // number of rows varies depending on number of items in list
    const ROWS = Math.ceil(arr.length / COLS);

    let acc = [...new Array(COLS).fill(0).map(() => new Array())];
    let lastline = 0;
    for (let i = 0; i < arr.length; i++) {
        if (acc[lastline].length < ROWS) {
            acc[lastline].push(arr[i]);
        }
        if (acc[lastline].length == ROWS) {
            lastline++;
        }
    }

    const fillDiff = lista =>
        lista.map(x => {
            if (x.length < lista[0].length) {
                x.push(...new Array(lista[0].length - x.length).fill('  '));
            }
            return x;
        });

    const verticalRegroup = lista =>
        lista[0].map((_, i) => lista.map(subLista => subLista[i]));

    acc = verticalRegroup(fillDiff(acc))
        .map(tmp => {
            return (
                `\n ${ITEM_NAME_POINTERS} ` +
                tmp
                    .map(x =>
                        x.length > 0 ? x.padEnd(MAX_CHARS_PER_NAME, ' ') : ''
                    )
                    .join(`${SPACE_BETWEEN_COLS}${ITEM_NAME_POINTERS} `)
                    .replaceAll(ITEM_NAME_POINTERS + '  ', '')
            );
        })
        .join('');
    return acc;
};

(function () {
    const fs = require('fs');
    const argv = process.argv;
    const args = argv.slice(1);
    const tool = args[1];
    const path = `${__dirname}/${tool}/index.js`;

    process.argv = args;

    const getAvailableTools = () => {
        return (
            fs
                .readdirSync(__dirname, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(x => x.name)
                // Filters projects with names starting with '_' and '.'
                // usually projects still in work and hidden folders
                .filter(
                    d =>
                        !d.startsWith('.') &&
                        !d.startsWith('_') &&
                        !d.startsWith('node_modules')
                )
        );
    };

    const compileContentVersionString = () => {
        const toollist = getAvailableTools();
        let versionstring = '';
        for (let tool of toollist)
            versionstring += `;${tool}:${
                JSON.parse(
                    fs.readFileSync(`${__dirname}/${tool}/package.json`, 'utf8')
                ).version
            }`;
        versionstring = versionstring.slice(1); // Remove the first trailing delimiter
        return versionstring;
    };

    const compileContentVersionHash = vstring => {
        const versionstring = vstring || compileContentVersionString();
        return murmurHash(versionstring, versionstring.length);
    };

    const partialMatches = fragment => {
        let acc = [];
        let tools = getAvailableTools();
        for (let i = 0; i < tools.length; i++) {
            if (
                (fragment.length >= 2 && tools[i].includes(fragment)) ||
                diceCoefficient(fragment, tools[i], 2) > 0.6
            ) {
                acc.push(tools[i]);
            }
        }
        return acc;
    };

    //       ╔═════════════════════╗
    //     ╔═╣  mmmmm       mmmmm  ║
    //   ╔═╣ ║   mmmmm     mmmmm   ║
    //   ║ ║ ║    mm mm   mm mm    ║
    //   ║ ║ ║    mm  mm mm  mm    ║
    //   ║ ║ ║    mm   mmm   mm    ║
    //   ║ ║ ║    mm    m    mm    ║
    //   ║ ║ ║   mmmm       mmmm   ║
    //   ║ ║ ╚═══════════════════╦═╝
    //   ║ ╚═══════════════════╦═╝
    //   ╚═════════════════════╝

    const help = `

    [mods-js]                                                   ╔═════════════════════╗
    A executable wrapper for many modules.                    ╔═╣  mmmmm       mmmmm  ║
                                                            ╔═╣ ║   mmmmm     mmmmm   ║
    Usage:                                                  ║ ║ ║    mm mm   mm mm    ║
        mods -l | --list                                    ║ ║ ║    mm  mm mm  mm    ║
        mods -h | --help [MODULE]                           ║ ║ ║    mm   mmm   mm    ║
        mods -i | --info [MODULE]                           ║ ║ ║    mm    m    mm    ║
        mods -v | --version [MODULE]                        ║ ║ ║   mmmm       mmmm   ║
        mods -V | --content-version                         ║ ║ ╚═══════════════════╦═╝
        mods <module> [...args]                             ║ ╚═══════════════════╦═╝
                                                            ╚═════════════════════╝`;

    if (!tool || ['--help', '-h'].includes(tool)) {
        if (args[2]) {
            process.argv = process.argv.slice(1);
            process.argv.push('--help');
            return require(path);
        } else {
            console.log(help);
        }
    } else if (['--list', '-l'].includes(tool)) {
        const toollist =
            `\n Available Modules:\n` + formatVerticalList(getAvailableTools());
        console.log(toollist);
    } else if (['-V', '--content-version'].includes(tool)) {
        const versionstring = compileContentVersionString();
        const versionhash = compileContentVersionHash(versionstring);
        console.log(`$${versionhash}$${versionstring}`);
    } else if (['--info', '-i'].includes(tool)) {
        if (args[2]) {
            let pkg;
            try {
                pkg = require(`${__dirname}/${args[2]}/package.json`);
            } catch {
                return console.log(
                    `Error: Could not locate 'package.json' file of module [${
                        args[2] || ''
                    }]`
                );
            }
            console.log(
                `\n Name:         ${pkg.name} \n Version:      ${
                    pkg.version
                } \n Description:  ${pkg.description || ''}`
            );
        } else {
            let pkg = require(`./package.json`);
            console.log(
                `\n Name:         ${pkg.name} \n Version:      ${
                    pkg.version
                } \n Description:  ${pkg.description || ''}`
            );
        }
    } else if (['--version', '-v'].includes(tool)) {
        if (args[2]) {
            let pkg;
            try {
                pkg = require(`${__dirname}/${args[2]}/package.json`);
            } catch {
                return console.log(
                    `Error: Could not locate 'package.json' file of module [${
                        args[2] || ''
                    }]`
                );
            }
            console.log(pkg.version);
        } else {
            let pkg = require(`./package.json`);
            console.log(pkg.version + '.' + compileContentVersionHash());
        }
    } else if (fs.existsSync(path)) {
        return require(path);
    } else {
        let partials = partialMatches(tool);
        if (partials.length == 0) {
            // Check if the user misspelled a command
            if (diceCoefficient('list', tool.replaceAll('-', ''), 1) > 0.6)
                console.log(
                    `Error: [${tool}] not found. \nDid you mean [--list]?`
                );
            else if (diceCoefficient('help', tool.replaceAll('-', ''), 1) > 0.6)
                console.log(
                    `Error: [${tool}] not found. \nDid you mean [--help]?`
                );
            else
                console.log(
                    `Error: [${tool}] not found. See --help for usage. Or --list for all modules.`
                );
        } else {
            // Check if the user mispelled a module
            console.log(
                `\n Error: [${tool}] not found. See --help for usage. Or --list for all modules.`
            );
            const toollist =
                `\n Partial matches found:\n` + formatVerticalList(partials);
            console.log(toollist);
        }
    }
})();

/*


    `
        ╔═════════════════════╗
      ╔═╣  mmmmm       mmmmm  ║
    ╔═╣ ║   mmmmm     mmmmm   ║
    ║ ║ ║    mm mm   mm mm    ║
    ║ ║ ║    mm  mm mm  mm    ║
    ║ ║ ║    mm   mmm   mm    ║
    ║ ║ ║    mm    m    mm    ║
    ║ ║ ║   mmmm       mmmm   ║
    ║ ║ ╚═══════════════════╦═╝
    ║ ╚═══════════════════╦═╝
    ╚═════════════════════╝`;
*/
