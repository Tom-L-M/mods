const fs = require('node:fs');

const isSTDINActive = () => !process.stdin.isTTY;

/**
 * Parses the CLI arguments (process.argv), dividing the flags into properties of an object.
 * Multi-word params are divided as "param":"value", while sinle-word params becomes: "param":true.
 * Lost values will be ignored*. So 'node example.js 000 --param1' will turn into: { param1:true } and '000' will be ignored.
 *   * Unless they are defined as aliases for other parameters. So, if mapping is defined as { '000':'param0' },
 *     the result will be { param1:true, param0: true } instead of { param1:true }
 * Aliases in 'mapping' do not take priority over regular double-word parameters
 *
 * @since 1.2.14
 *
 * @param {Object} mapping An object mapping the arguments alias. Always take the form of "alias":"originalProperty"
 * @return {Object} An object containing the arguments parsed, and their values
 *
 * @example <caption>  </caption>
 * // called the script with:
 * // node example.js build --param1 --param2 pvalue -p 0000
 * parseArgv({ "p": "param3" })
 * // creates:
 * {
 *   build: true
 *   param1: true
 *   param2: p2value
 *   param3: 0000
 * }
 */
const parseArgv = (mapping = {}, argv = process.argv.slice(2)) => {
    let params = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '-') params['-'] = true;
        else if (argv[i] === '--') params['--'] = true;
        else if (argv[i].startsWith('--'))
            params[argv[i].slice(2)] =
                argv[i + 1]?.startsWith('-') || !argv[i + 1] ? true : argv[++i];
        else if (argv[i].startsWith('-'))
            params[argv[i].slice(1)] =
                argv[i + 1]?.startsWith('-') || !argv[i + 1] ? true : argv[++i];
        else params[argv[i]] = true;
    }
    for (let key in mapping) {
        if (params[key]) {
            params[mapping[key]] = params[key];
            delete params[key];
        }
    }
    return params;
};

function readStdinAsync() {
    return new Promise((resolve, reject) => {
        const stream = process.stdin;
        const chunks = [];

        const onData = chunk => chunks.push(chunk);
        const onEnd = () => quit() && resolve(Buffer.concat(chunks));
        const onError = err => quit() && reject(err);

        const quit = () => {
            stream.removeListener('data', onData);
            stream.removeListener('end', onEnd);
            stream.removeListener('error', onError);
            return true;
        };

        stream.on('data', onData);
        stream.on('end', onEnd);
        stream.on('error', onError);
    });
}

function printVersion() {
    try {
        console.log(require('./package.json').version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

/**
 * Parses a CSV string and returns an Array representation as a table.
 * @param {string} data
 * @param {string} separator The cell separator used. Default for CSV is ','.
 * @returns {string[]} A 2D-Array representing the CSV table
 */
function parseCSV(data, { separator = ',' } = {}) {
    const rows = data.trim().split('\n');
    const cols = rows.map(row => {
        let insideQuotes = false;
        let cell = '';
        const cells = [];
        for (let char of row) {
            if (char === '"') insideQuotes = !insideQuotes;
            if (char === separator && !insideQuotes)
                cells.push(cell), (cell = '');
            else cell += char;
        }
        return cells;
    });
    return cols;
}

/**
 * Takes in a 1D or 2D array, and return it as a table string
 * @param {array[]} table
 * @param {boolean} rulers Controls whether horizontal table borders should be printed.
 * @param {number} maxCellSize The maximum length a cell content can span.
 */
function tableify(
    rawtable,
    { rulers = true, maxCellSize, noHeader = false } = {}
) {
    const V = '│';
    const H = '─';
    const C = '┼';
    const Q1 = '┌';
    const Q2 = '┐';
    const Q3 = '└';
    const Q4 = '┘';
    const T1 = '┬';
    const T2 = '┴';
    const T3 = '├';
    const T4 = '┤';

    const is2D = arr => Array.isArray(arr[0]);
    const maxsize = parseInt(maxCellSize) || null;
    const table =
        !is2D(rawtable) || !maxsize
            ? rawtable
            : rawtable.map(v => v.map(x => x.slice(0, maxsize)));

    if (!is2D(table)) {
        let body = `${V} ${table.join(` ${V} `)} ${V}`;
        let header = `${Q1}${H.repeat(body.length - 2)}${Q2}`;
        let footer = `${Q3}${H.repeat(body.length - 2)}${Q4}`;
        let crossIndexes = body
            .split('')
            .map((c, i) => (c === V ? i : null))
            .filter(v => v !== null)
            .slice(1, -1);
        header = header
            .split('')
            .map((v, i) => (crossIndexes.includes(i) ? T1 : v))
            .join('');
        footer = footer
            .split('')
            .map((v, i) => (crossIndexes.includes(i) ? T2 : v))
            .join('');

        return `${header}\n${body}\n${footer}`;
    }

    if (is2D(table) && !rulers) {
        const longestOfColumn = new Array(table[0].length).fill(0);
        for (let line of table) {
            for (let i = 0; i < line.length; i++) {
                if (longestOfColumn[i] < line[i].length)
                    longestOfColumn[i] = line[i].length;
            }
        }

        let body = [];
        for (let line of table) {
            for (let i = 0; i < line.length; i++)
                line[i] = line[i].padEnd(longestOfColumn[i], ' ');
            body.push(`${V} ${line.join(` ${V} `)} ${V}`);
        }

        let header = `${Q1}${H.repeat(body[0].length - 2)}${Q2}`;
        let footer = `${Q3}${H.repeat(body[0].length - 2)}${Q4}`;
        let titleHeader = `${T3}${H.repeat(body[0].length - 2)}${T4}`;
        let crossIndexes = body[0]
            .split('')
            .map((c, i) => (c === V ? i : null))
            .filter(v => v !== null)
            .slice(1, -1);
        header = header
            .split('')
            .map((v, i) => (crossIndexes.includes(i) ? T1 : v))
            .join('');
        footer = footer
            .split('')
            .map((v, i) => (crossIndexes.includes(i) ? T2 : v))
            .join('');
        titleHeader = titleHeader
            .split('')
            .map((v, i) => (crossIndexes.includes(i) ? C : v))
            .join('');

        if (!noHeader)
            body = [body[0], titleHeader, ...body.slice(1)].join('\n');
        else body = [body[0], ...body.slice(1)].join('\n');
        return `${header}\n${body}\n${footer}`;
    }

    if (is2D(table)) {
        const longestOfColumn = new Array(table[0].length).fill(0);
        for (let line of table) {
            for (let i = 0; i < line.length; i++) {
                if (longestOfColumn[i] < line[i].length)
                    longestOfColumn[i] = line[i].length;
            }
        }

        let body = [];
        for (let line of table) {
            for (let i = 0; i < line.length; i++) {
                line[i] = line[i].padEnd(longestOfColumn[i], ' ');
            }
            let main = `${V} ${line.join(` ${V} `)} ${V}`;
            let footer = `${T3}${H.repeat(main.length - 2)}${T4}`;
            let crossIndexes = main
                .split('')
                .map((c, i) => (c === V ? i : null))
                .filter(v => v !== null)
                .slice(1, -1);
            footer = footer
                .split('')
                .map((v, i) => (crossIndexes.includes(i) ? C : v))
                .join('');

            body.push(main, footer);
        }

        // Remove the trailing row footer at the end;
        body.pop();

        let header = `${Q1}${H.repeat(body[0].length - 2)}${Q2}`;
        let footer = `${Q3}${H.repeat(body[0].length - 2)}${Q4}`;
        let crossIndexes = body[0]
            .split('')
            .map((c, i) => (c === V ? i : null))
            .filter(v => v !== null)
            .slice(1, -1);
        header = header
            .split('')
            .map((v, i) => (crossIndexes.includes(i) ? T1 : v))
            .join('');
        footer = footer
            .split('')
            .map((v, i) => (crossIndexes.includes(i) ? T2 : v))
            .join('');

        body = body.join('\n');
        return `${header}\n${body}\n${footer}`;
    }
}

function range(start, end, step = 1) {
    return Array.from(
        { length: Math.ceil((end - start + 1) / step) },
        (_, i) => i * step + start
    );
}

const help = `
    [csv-js]
        A csv viewer command line utility in NodeJS.

    Usage:
        node csv <file> [options]
        <stdin> | node csv [options]

    Options:        
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -s | --separator N      The cell separator. Defaults to a comma: ','.
        -l | --rulers           Add horizontal rulers between lines.
        -m | --max-cell-size N  The max number of chars per cell.
        -e | --header           Prints the table header and/or include in computations.
        -f | --field N,M        Prints the content of the cell at COL N x ROW M.
        -c | --cols N,M,X-Y     Prints the selected columns.
        -r | --rows N,M,X-Y     Prints the selected rows.
        -C | --col-count        Prints the number of columns.
        -R | --row-count        Prints the number of rows.
        -F | --field-count      Prints the number of fields.
        
    Examples:
        > Print number of cells, including the header cells:
            csv file.csv -F -e
        > Print whole file as a TSV instead of CSV:
            csv file.tsv -s "\\t"
        > Print rows 0 to 10, 14, and 20 up to the end:
            csv file.csv -c 0-10,14,20-
        > Prints the last rows, with the header:
            csv file.csv -c 900- -e`;

(async function () {
    const opts = {
        h: 'help',
        v: 'version',
        s: 'separator',
        l: 'rulers',
        m: 'max-cell-size',
        e: 'header',
        C: 'col-count',
        R: 'row-count',
        F: 'field-count',
        f: 'field',
        c: 'cols',
        r: 'rows',
    };
    const args = parseArgv(opts);
    const file = process.argv[2];

    const stdinActive = isSTDINActive();

    if (args.help || (!stdinActive && !file)) return console.log(help);
    if (args.version) return printVersion();

    if (!stdinActive && !fs.existsSync(file))
        return console.log(`Error: Invalid file path provided [${file}]`);

    const input = stdinActive
        ? (await readStdinAsync()).toString('utf-8')
        : fs.readFileSync(file, 'utf-8');

    const maxCellSize = parseInt(args['max-cell-size']) || null;
    const rulers = Boolean(args.rulers);
    const separator =
        args.separator && typeof args.separator === 'string'
            ? args.separator
            : ',';

    let csv = parseCSV(input, { separator });

    // If asking for field count:
    if (args['field-count'])
        if (args['header']) return console.log(csv[0].length * csv.length);
        else return console.log(csv[0].length * (csv.length - 1));
    // If asking for column count
    if (args['col-count']) return console.log(csv[0].length);
    // If asking for row count
    if (args['row-count']) return console.log(csv.length);

    if (args['field']) {
        let [N, M] = args['field'].split(',');
        N = parseInt(N);
        M = parseInt(M);
        if ((!N && N !== 0) || (!M && M !== 0))
            return console.log(
                'Error: field selector should include two valid numeric coordinates'
            );
        return console.log(csv[N][M]);
    }

    if (args['rows']) {
        if (typeof args['rows'] !== 'string')
            return console.log('Error: expected a value for row selector');
        let rows = args['rows'].split(',');
        let selected = [];
        for (let item of rows) {
            if (!item.includes('-')) selected.push(parseInt(item));
            else {
                let [rangeStart, rangeEnd] = item.split('-');
                rangeStart = parseInt(rangeStart) || 0;
                rangeEnd = parseInt(rangeEnd) || csv.length;
                selected.push(...range(rangeStart, rangeEnd));
            }
        }

        if (args['header'])
            selected = [0, ...new Set(selected)].sort((a, b) => a - b);
        else selected = [...new Set(selected)].sort((a, b) => a - b);

        csv = csv.filter((v, i) => selected.includes(i));
    }

    if (args['cols']) {
        if (typeof args['cols'] !== 'string')
            return console.log('Error: expected a value for column selector');
        let cols = args['cols'].split(',');
        let selected = [];
        for (let item of cols) {
            if (!item.includes('-')) selected.push(parseInt(item));
            else {
                let [rangeStart, rangeEnd] = item.split('-');
                rangeStart = parseInt(rangeStart) || 0;
                rangeEnd = parseInt(rangeEnd) || csv.length;
                selected.push(...range(rangeStart, rangeEnd));
            }
        }

        selected = [...new Set(selected)].sort((a, b) => a - b);
        csv = csv.map(v => v.filter((_, i) => selected.includes(i)));
    }

    // If asking for header
    else if (args['header'] && !args['cols'] && !args['rows'])
        return console.log(tableify(csv[0]));
    // If not asking for something specific -> pretty print with header
    else if (!args['header'] && !args['cols'] && !args['rows'])
        return console.log(tableify(csv, { rulers, maxCellSize }));

    // Else, just prints table:
    return console.log(
        tableify(csv, { rulers, maxCellSize, noHeader: !args['header'] })
    );
})();
