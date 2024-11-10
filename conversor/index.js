const help = `
    [conversor-js]
        A tool for converting data in different bases (hex/bin/octal/dec/text)

    Usage:
        conversor <inputType> <outputType> <content> [options] [--pad X] [--separator Y]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -p | --pad X            Defines the number of digits the outputted numbers and chars must have.
                                If the padding level is smaller than the number of digits in the output, 
                                they are not affected. Using --pad in multiple-output strings, makes 
                                all the different outputs to be padded individually.
        -s | --separator X      Defines what will be the output separator for multiple number sets
                                Default is ' ' (one space).

    Input/Ouput Types:
        dec, hex, bin, txt, oct

    Info:
        > Passing one content byte ex:
            conversor dec hex 1 --pad 8     // (--separator has no effect here)
                returns     00000001
        > Passing many content bytes (must be wrapped with "") 
            ex:
                conversor dec hex "8 9 10 11" --pad 2 --separator " "
                    returns:    008 009 00A 00B
            ex:        
                conversor txt hex "s a l v e" --pad 2 --separator -
                    returns:    73-61-6c-76-65`;

(function () {
    const args = process.argv.slice(2);

    if (args.includes('--version') || args.includes('-v'))
        return console.log(require('./package.json')?.version);

    if (args.includes('--help') || args.includes('-h'))
        return console.log(help);

    const input = args[0];
    const output = args[1];
    const content = args[2];
    const padsizes = args.includes('--pad')
        ? Number(args[args.indexOf('--pad') + 1])
        : 0;
    const separator = args.includes('--separator')
        ? args[args.indexOf('--separator') + 1]
        : ' ';
    const basemap = { hex: 16, dec: 10, oct: 8, bin: 2, txt: 36 };
    if (!input || !output || !content) return console.log(help);
    let tmpIn = content.split(' '),
        tmpOu = [];
    const inputbase = basemap[input];
    const outputbase = basemap[output];
    if (!inputbase)
        return console.log('<> Error: Invalid input type selected: ' + input);
    if (!outputbase)
        return console.log('<> Error: Invalid output type selected: ' + output);

    switch (inputbase) {
        case 16:
            tmpOu = tmpIn.map(x => parseInt(x, 16));
            break;
        case 10:
            tmpOu = tmpIn.map(x => parseInt(x, 10));
            break;
        case 8:
            tmpOu = tmpIn.map(x => parseInt(x, 8));
            break;
        case 2:
            tmpOu = tmpIn.map(x => parseInt(x, 2));
            break;
        case 36:
            tmpOu = tmpIn.map(x => x.charCodeAt(0));
            break;
    }

    switch (outputbase) {
        case 16:
            tmpOu = tmpOu.map(x => x.toString(16));
            break;
        case 10:
            tmpOu = tmpOu.map(x => x.toString(10));
            break;
        case 8:
            tmpOu = tmpOu.map(x => x.toString(8));
            break;
        case 2:
            tmpOu = tmpOu.map(x => x.toString(2));
            break;
        case 36:
            tmpOu = tmpOu.map(x => String.fromCharCode(x));
            break;
    }

    tmpOu = tmpOu.map(x => x.padStart(padsizes, '0')).join(separator);
    console.log(tmpOu);
})();
