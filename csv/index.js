const fs = require('node:fs');
const { parseArgv, isSTDINActive, readStdinAsync } = require('../shared');

/**
 * Parses a CSV string and returns an Array representation as a table.
 * @param {string} data
 * @param {string} separator The cell separator used. Default for CSV is ','.
 * @param {boolean} addIndex If set to true, adds a 'Index' column to the right, indexing starts at 1.
 * @returns {string[]} A 2D-Array representing the CSV table
 */
function parseCSV(data, { separator = ',', addIndex = false } = {}) {
    let rows = data.trim().split('\n');
    if (addIndex) {
        rows = [
            'Index' + separator + rows[0],
            ...rows.slice(1).map((v, i) => i + 1 + separator + v),
        ];
    }
    let cols = rows.map(row => {
        // Add a separator in the end of the line, so that
        // the last field is parsed as a regular one
        // avoids the need of a special-case handler
        row = row.trim() + separator;
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

function activateSpecialChars(string) {
    return string
        .replaceAll('\\t', '\t')
        .replaceAll('\\n', '\n')
        .replaceAll('\\s', ' ');
}

function listify(rawtable, separator) {
    if (typeof separator !== 'string') separator = ',';
    separator = activateSpecialChars(separator);
    return rawtable
        .map(v => (Array.isArray(v) ? v.join(separator) : v))
        .join('\n');
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
        -E | --no-header        Do NOT print the table header nor include in computations.
        -f | --field N,M        Prints the content of the cell at COL N x ROW M.
        -c | --cols N,M,X-Y     Prints the selected columns.
        -r | --rows N,M,X-Y     Prints the selected rows.
        -C | --col-count        Prints the number of columns.
        -R | --row-count        Prints the number of rows.
        -F | --field-count      Prints the number of fields.
        -L | --list N           Prints the selected information as a list with separator N.
        -i | --index            Adds an "index" column as the first column.
        
    Info:
        If more than one of '-C', '-R', '-F' is selected, the order in which they are printed
        is always:   columns > rows > fields. (e.g. "csv file.csv -R -F -C" prints "{COLS} {ROWS} {FIELDS}")

    Examples:
        > Print number of cells, including the header cells:
            csv file.csv -F -e
        > Read a TSV file instead of a CSV:
            csv file.tsv -s "\\t"
        > Print rows 0 to 10, 14, and 20 up to the end:
            csv file.csv -c 0-10,14,20-
        > Prints the last rows, with the header:
            csv file.csv -c 900- -e
        > Reads a CSV file and print the first 2 columns as a TSV:
            csv file.csv -c 1,2 -L "\\t"`;

(async function () {
    const opts = {
        h: 'help',
        v: 'version',
        s: 'separator',
        l: 'rulers',
        m: 'max-cell-size',
        e: 'header',
        E: 'no-header',
        C: 'col-count',
        R: 'row-count',
        F: 'field-count',
        f: 'field',
        c: 'cols',
        r: 'rows',
        L: 'list',
        i: 'index',
    };
    const args = parseArgv(opts);
    const file = process.argv[2];

    const stdinActive = isSTDINActive();

    if (args.help || (!stdinActive && !file)) return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    if (!stdinActive && !fs.existsSync(file))
        return console.log(`Error: Invalid file path provided [${file}]`);

    const input = stdinActive
        ? (await readStdinAsync()).toString('utf-8')
        : fs.readFileSync(file, 'utf-8');

    const maxCellSize = parseInt(args['max-cell-size']) || null;
    const rulers = Boolean(args.rulers);
    const separator = activateSpecialChars(
        args.separator && typeof args.separator === 'string'
            ? args.separator
            : ','
    );

    const addIndex = Boolean(args.index);

    let csv = parseCSV(input, { separator, addIndex });

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

    // If asking for column count
    if (args['col-count']) process.stdout.write(csv[0].length + ' ');
    // If asking for row count
    if (args['row-count'])
        if (args['header']) process.stdout.write(csv.length + ' ');
        else process.stdout.write(csv.length - 1 + ' ');
    // If asking for field count:
    if (args['field-count'])
        if (args['header'])
            process.stdout.write(csv[0].length * csv.length + ' ');
        else process.stdout.write(csv[0].length * (csv.length - 1) + ' ');

    // If any of the above was selected, return
    if (args['field-count'] || args['col-count'] || args['row-count']) return;

    // If asking for header
    if (args['header'] && !args['cols'] && !args['rows']) {
        if (args['list']) console.log(listify(csv[0], args['list']));
        else console.log(tableify(csv[0]));
        return;
    }
    // If asking without header -> pretty print without header
    else if (args['no-header'] && !args['cols'] && !args['rows']) {
        if (args['list']) console.log(listify(csv.slice(1), args['list']));
        else
            console.log(
                tableify(csv.slice(1), {
                    rulers,
                    maxCellSize,
                    noHeader: true,
                })
            );
        return;
    }
    // If not asking for something specific -> pretty print with header
    else if (!args['header'] && !args['cols'] && !args['rows']) {
        if (args['list']) console.log(listify(csv, args['list']));
        else console.log(tableify(csv, { rulers, maxCellSize }));
        return;
    }

    // Else, just prints table:
    if (args['list']) console.log(listify(csv, args['list']));
    else
        console.log(
            tableify(csv, {
                rulers,
                maxCellSize,
                noHeader: args['header']
                    ? false
                    : args['no-header']
                    ? true
                    : false,
            })
        );
})();

/**
 *
 * TODO:
 *
 * add flags for filtering, matching, and sorting the table
 *
 * // Sort rows according to a specific column
 * -s | --sort < column-index | column-name >,<ascending|descending>
 * // Return only rows that have the cell at a specific column matching the regex
 * -f | --filter < column-index | column-name | - >,<regex|string>
 *
 */
