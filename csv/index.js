const fs = require('node:fs');
const {
    isStdinActive,
    readStdin,
    ArgvParser,
    parseControlChars,
} = require('../shared');

/**
 * Parses a CSV string and returns an Array representation as a table.
 * @param {string} data
 * @param {string} separator The cell separator used. Default for CSV is ','.
 * @param {boolean} addIndex If set to true, adds a 'Index' column to the right, indexing starts at 1.
 * @returns {string[][]} A 2D-Array representing the CSV table
 */
function parseCSV(data, { separator = ',', addIndex = false } = {}) {
    let rows = data.trim().split('\n');
    if (addIndex && !rows[0].startsWith('Index' + separator)) {
        rows = [
            'Index' + separator + rows[0],
            ...rows.slice(1).map((v, i) => i + 1 + separator + v),
        ];
    }
    let cols = rows.map(row => {
        row = row.trim() + separator; // Add separator at the end
        let insideQuotes = false;
        let cell = '';
        const cells = [];
        const sepLength = separator.length;
        let i = 0;

        while (i < row.length) {
            if (row[i] === '"') {
                insideQuotes = !insideQuotes;
                cell += row[i];
                i++;
                continue;
            }

            if (!insideQuotes && row.startsWith(separator, i)) {
                cells.push(cell);
                cell = '';
                i += sepLength;
                continue;
            }

            cell += row[i];
            i++;
        }
        return cells;
    });
    return cols;
}

function listify(rawtable, separator) {
    if (typeof separator !== 'string') separator = ',';
    separator = parseControlChars(separator);
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
    {
        padStart = false,
        rulers = true,
        maxCellSize,
        noHeader = false,
        useAscii = false,
    } = {}
) {
    const asciibox = {
        V: '|',
        H: '-',
        C: '+',
        Q1: '+',
        Q2: '+',
        Q3: '+',
        Q4: '+',
        T1: '+',
        T2: '+',
        T3: '+',
        T4: '+',
    };

    const betterbox = {
        V: '│',
        H: '─',
        C: '┼',
        Q1: '┌',
        Q2: '┐',
        Q3: '└',
        Q4: '┘',
        T1: '┬',
        T2: '┴',
        T3: '├',
        T4: '┤',
    };

    const boxset = useAscii ? asciibox : betterbox;
    const { V, H, C, Q1, Q2, Q3, Q4, T1, T2, T3, T4 } = boxset;

    if (rawtable.length === 1) rawtable = rawtable[0];

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
            for (let i = 0; i < line.length; i++) {
                if (padStart)
                    line[i] = line[i].padStart(longestOfColumn[i], ' ');
                else line[i] = line[i].padEnd(longestOfColumn[i], ' ');
            }
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
        -H | --help-all         Prints the entire help menu and quits.
        -v | --version          Prints the version info and quits.
        -s | --separator N      The cell separator string. Defaults to a comma: ','.
        -l | --rulers           Add horizontal rulers between lines.
        -a | --ascii            Replaces the box-drawing special chars for the classic ASCII chars.
        -p | --pad-start        Pads the cells aligning the content right instead of left.
        -m | --max-cell-size N  The max number of chars allowed per cell (the rest is truncated).
        -i | --index            Adds an "index" column (only if first column is NOT already 'Index').
        -f | --field N,M        Prints the cell at col N and row M ("N"/"M" may be names or indexes).
        -c | --cols N,M,X-Y     Prints the selected columns.
        -r | --rows N,M,X-Y     Prints the selected rows.
        -e | --header           Prints the table header and/or include in computations.
        -E | --no-header        Do NOT print the table header nor include in computations.
        -C | --col-count        Prints the number of columns.
        -R | --row-count        Prints the number of rows.
        -F | --field-count      Prints the number of fields.
        -L | --list N           Prints the selected information as a list with separator N.
        -I | --insensitive      If used with '-M', makes the regexp case insensitive.
        -S | --sort N,M         Sorts a table using column N as reference.
                                "N" must be either a column name, or its index.
                                "M" must be one of: "asc", "ascending", "des" or "descending".
        -M | --match N,M        Filters a table with RegExp using column N as reference.
                                "N" must be either a column name, or its index.
                                "M" must be a regular expression string.
        -B | --number-bars N    Add graph bars to numeric cells. N is optional and is the scale.
                        (the value will be divided by N to set the number of bars).`;

const fullHelp = `
    [csv-js]
        A csv viewer command line utility in NodeJS.

    Usage:
        node csv <file> [options]
        <stdin> | node csv [options]

    Options:        
        -h | --help             Prints the help message and quits.
        -H | --help-all         Prints the entire help menu and quits.
        -v | --version          Prints the version info and quits.
        -s | --separator N      The cell separator string. Defaults to a comma: ','.
        -l | --rulers           Add horizontal rulers between lines.
        -a | --ascii            Replaces the box-drawing special chars for the classic ASCII chars.
        -p | --pad-start        Pads the cells aligning the content right instead of left.
        -m | --max-cell-size N  The max number of chars allowed per cell (the rest is truncated).
        -i | --index            Adds an "index" column (only if first column is NOT already 'Index').
        -f | --field N,M        Prints the cell at col N and row M ("N"/"M" may be names or indexes).
        -c | --cols N,M,X-Y     Prints the selected columns.
        -r | --rows N,M,X-Y     Prints the selected rows.
        -e | --header           Prints the table header and/or include in computations.
        -E | --no-header        Do NOT print the table header nor include in computations.
        -C | --col-count        Prints the number of columns.
        -R | --row-count        Prints the number of rows.
        -F | --field-count      Prints the number of fields.
        -L | --list N           Prints the selected information as a list with separator N.
        -B | --number-bars N    Add graph bars to numeric cells. N is optional and is the scale.
                                (the value will be divided by N to set the number of bars).

    Sorting and filtering:
        -S | --sort N,M         Sorts a table using column N as reference.
                                "N" must be either a column name, or its index.
                                "M" must be one of: "asc", "ascending", "des" or "descending".

        -M | --match N,M        Filters a table with RegExp using column N as reference.
                                "N" must be either a column name, or its index.
                                "M" must be a regular expression string.

        -I | --insensitive      If used with '-M', makes the regexp case insensitive.
        
    Info:
        Indexing in starts at 1 vertically. But starts at 1 horizontally only if "-i" is used or there is a native Index column.
        Row index 0 is always the header. While col index 0 is either the Index (if any) or the first column of data.
        To force horizontal index to start at 1, use the "-i" flag to add an index column. When using "-i", the Index will
        only be added if there is no Index column alread. If the table already had a native Index column, nothing will happen.
        This ensures the horizontal index 0 will be the Index column, despite having a native column for index or not.

        If more than one of '-C', '-R', '-F' is selected, the order in which they are printed
        is always:   columns > rows > fields. (e.g. "csv file.csv -R -F -C" prints "{COLS} {ROWS} {FIELDS}")

    Examples:
        > Print number of cells, including the header cells:
            csv file.csv -F -e
        > Read a TSV file instead of a CSV:
            csv file.tsv -s "\\t"
        > Print rows 0 to 10, 14, and 20 up to the end:
            csv file.csv -c 0-10,14,20-
        > Reads a CSV file and print the first 2 columns as a TSV:
            csv file.csv -c 1,2 -L "\\t"
        > Reads a CSV, sort by descending index, filter by cells in col 2 ("Values") matching a regex:
            // Matches cells containing only phone numbers: (NN) 9AAAAA-BBBB
            csv file.csv -S 0,descending -F "Values,^\\([0-9]{2}\\) 9[0-9]{5}-[0-9]{4}$"`;

(async function () {
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('help-all', { alias: 'H', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('separator', { alias: 's' });
    parser.option('rulers', { alias: 'l', allowValue: false });
    parser.option('ascii', { alias: 'a', allowValue: false });
    parser.option('pad-start', { alias: 'p', allowValue: false });
    parser.option('max-cell-size', { alias: 'm', allowCasting: true });
    parser.option('number-bars', { alias: 'B', allowCasting: true });
    parser.option('header', { alias: 'e', allowValue: false });
    parser.option('no-header', { alias: 'E', allowValue: false });
    parser.option('col-count', { alias: 'C', allowValue: false });
    parser.option('row-count', { alias: 'R', allowValue: false });
    parser.option('field-count', { alias: 'F', allowValue: false });
    parser.option('cols', { alias: 'c' });
    parser.option('rows', { alias: 'r' });
    parser.option('list', { alias: 'L' });
    parser.option('index', { alias: 'i', allowValue: false });
    parser.option('field', { alias: 'f', allowMultiple: true });
    parser.option('sort', { alias: 'S' });
    parser.option('match', { alias: 'M' });
    parser.option('insensitive', { alias: 'I', allowValue: false });
    parser.argument('file');

    const args = parser.parseArgv();
    const file = args.file;

    const stdinActive = isStdinActive();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args['help-all']) return console.log(fullHelp);
    if (args.help || (!stdinActive && !file)) return console.log(help);

    if (args._invalid.length > 0)
        return console.log(
            `[x] Error: invalid parameters [ ${args._invalid.join(', ')} ]`
        );

    if (!stdinActive && !fs.existsSync(file))
        return console.log(`Error: Invalid file path provided [${file}]`);

    const input = stdinActive
        ? (await readStdin()).toString('utf-8')
        : fs.readFileSync(file, 'utf-8');

    const maxCellSize = parseInt(args['max-cell-size']) || null;
    const rulers = Boolean(args.rulers);
    const useAscii = Boolean(args.ascii);
    const separator = parseControlChars(
        args.separator && typeof args.separator === 'string'
            ? args.separator
            : ','
    );

    const addIndex = Boolean(args.index);
    const padStart = Boolean(args['pad-start']);

    let csv = parseCSV(input, { separator, addIndex });
    const originalHeader = csv[0];

    if (args['number-bars'] !== undefined) {
        for (let i = 1; i < csv.length; i++) {
            csv[i] = csv[i].map(v => {
                const line = !isNaN(v)
                    ? '■'.repeat(
                          v /
                              (args['number-bars'] > 0
                                  ? args['number-bars']
                                  : 1)
                      ) + ' '
                    : '';
                return `${line}${v}`;
            });
        }
    }

    if (args['field']) {
        for (let xfield of args['field']) {
            let [N, M] = xfield.split(',');
            const xN = parseInt(N);
            if (isNaN(xN)) {
                N = originalHeader.indexOf(N);
                if (N < 0) {
                    return console.log(
                        'Error: field selector for column should be either a valid column name or index'
                    );
                }
            } else {
                N = xN;
            }
            M = parseInt(M);
            if ((!N && N !== 0) || (!M && M !== 0))
                return console.log(
                    'Error: field selector should include two valid numeric coordinates'
                );
            console.log(csv[M][N] || '');
        }
        return;
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
    if (args['col-count']) {
        process.stdout.write(csv[0].length + ' ');
        return;
    }
    // If asking for row count
    if (args['row-count']) {
        if (args['header']) process.stdout.write(csv.length + ' ');
        else process.stdout.write(csv.length - 1 + ' ');
        return;
    }
    // If asking for field count:
    if (args['field-count']) {
        if (args['header'])
            process.stdout.write(csv[0].length * csv.length + ' ');
        else process.stdout.write(csv[0].length * (csv.length - 1) + ' ');
        return;
    }

    // If asking for a sorted version of the table:
    if (args['sort']) {
        if (typeof args['sort'] !== 'string')
            return console.log('Error: expected a value for sorting');
        let [xcol, xmode] = args['sort'].split(',');
        if (!'asc|ascending|des|descending'.split('|').includes(xmode))
            return console.log(
                'Error: expected a valid mode for sorting (asc|ascending|des|descending)'
            );
        if (!isNaN(parseInt(xcol))) {
            xcol = parseInt(xcol);
        } else {
            xcol = csv[0].indexOf(xcol);
        }
        if ((!xcol && typeof xcol !== 'number') || xcol < 0)
            return console.log(
                'Error: expected a valid column name or index for sorting' +
                    '\nDouble-check selected columns and selected column name (it is case-sensitive)'
            );

        csv = [
            csv[0],
            ...csv.slice(1).sort((a, b) => {
                let [rA, rB] = [a[xcol], b[xcol]];
                let [intA, intB] = [parseFloat(rA), parseFloat(rB)];
                // If both are numbers:
                if (
                    !!intA &&
                    !!intB &&
                    rA === intA.toString() &&
                    rB === intB.toString()
                )
                    (rA = intA), (rB = intB);
                if (xmode === 'asc' || xmode === 'ascending')
                    return rA < rB ? -1 : rA === rB ? 0 : 1;
                if (xmode === 'des' || xmode === 'descending')
                    return rA > rB ? -1 : rA === rB ? 0 : 1;
            }),
        ];
    }

    // If asking for a filtered version of the table:
    if (args['match']) {
        if (typeof args['match'] !== 'string')
            return console.log('Error: expected a value for matching');
        let [xcol, ...xregex] = args['match'].split(',');
        // If the regex contains ',' join it back
        try {
            xregex = new RegExp(xregex.join(','), args.insensitive ? 'i' : '');
        } catch {
            return console.log(
                'Error: expected a valid regular expression for matching'
            );
        }
        const numxcol = parseFloat(xcol);
        if (!isNaN(numxcol) && numxcol.toString() === xcol) {
            xcol = numxcol;
        } else {
            xcol = originalHeader.indexOf(xcol);
        }
        if ((!xcol && typeof xcol !== 'number') || xcol < 0)
            return console.log(
                'Error: expected a valid column name or index for matching' +
                    '\nDouble-check selected columns and selected column name (it is case-sensitive)'
            );

        csv = [csv[0], ...csv.slice(1).filter(v => xregex.test(v[xcol]))];
    }

    // If asking for header
    if (args['header'] && !args['cols'] && !args['rows']) {
        if (args['list']) console.log(listify(originalHeader, args['list']));
        else console.log(tableify(originalHeader, { padStart, useAscii }));
        return;
    }
    // If asking without header -> pretty print without header
    else if (args['no-header'] && !args['cols'] && !args['rows']) {
        if (args['list']) console.log(listify(csv.slice(1), args['list']));
        else
            console.log(
                tableify(csv.slice(1), {
                    padStart,
                    rulers,
                    maxCellSize,
                    noHeader: true,
                    useAscii,
                })
            );
        return;
    }
    // If not asking for something specific -> pretty print with header
    else if (!args['header'] && !args['cols'] && !args['rows']) {
        if (args['list']) console.log(listify(csv, args['list']));
        else
            console.log(
                tableify(csv, { padStart, rulers, maxCellSize, useAscii })
            );
        return;
    }

    // Else, just prints table:
    if (args['list']) console.log(listify(csv, args['list']));
    else
        console.log(
            tableify(csv, {
                padStart,
                rulers,
                maxCellSize,
                useAscii,
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
