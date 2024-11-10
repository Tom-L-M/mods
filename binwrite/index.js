const fs = require('fs');
const randomInt = (low, high) => Math.floor(Math.random() * (high - low) + low);
const randomByte = () => randomInt(0, 256);

const waitStreamWriting = (IStream, content) => {
    return new Promise(resolve => {
        IStream.once('close', () => resolve(true));
        IStream.once('error', () => resolve(false));
        IStream.write(content);
        IStream.close();
    });
};

const helpmsg = `
    [binwrite-js]
        A tool to write content to files as binary data

    Usage:
        binwrite <mode> <datatype> [-r R] <file> <data>

    Modes:
        -h | --help 
        -v | --version
        -a | --append
        -w | --write

    Datatypes:
        -x | --hex
        -b | --binary
        -t | --text
        -n | --number
        -f | --file
        -m | --random

    Repetition Mode: (-r | --repeat)
        Use [-r X] where X is a decimal number representing 
        the number of times to repeat the data.

    Info:
        > Using '-h' or '--help' displays this help message

        > If <datatype> is '-f' or '--file', <data> must be a valid file path

        > If <datatype> is '-r' or '--repeat', <X> must be a decimal number for quantity

        > If <datatype> is '-m' or '--random', <data> may be a valid number 
          to define the size of the random data

    Examples:
        > binwrite -a -x test.bin 01 02 03 04 05        
            > Appends the bytes '01 02 03 04 05' to the file test.bin
        > binwrite -w -b test.bin 10010011 10000000     
            > Writes the binary bytes '10010011 10000000' to the file test.bin (overrides the content)
        > binwrite -w -f test.png base.png              
            > Writes the content of base.png to test.png (basically binary file copying)
        > binwrite -w -m test.bin 100
            > Writes 100 random bytes to test.bin
        > binwrite -w -x -r 10 test.bin 77 88 99
            > Writes 10 times the trio of bytes '77 88 99' in test.bin: (77 88 99 77 88 99 77 88 99 ...)`;

(async function () {
    // binwrite <mode> <datatype> <file> <content>
    let args = process.argv.slice(2);
    let mode = args[0];
    if (mode == '-h' || mode == '--help' || !mode || args.length < 4)
        return console.log(helpmsg);

    if (mode == '-v' || mode == '--version')
        return console.log(require('./package.json')?.version);

    let datatype = args[1];
    let file = args[2];
    let content = args.slice(3);
    let repetitions = 1;

    if (file == '-r' || file == '--repeat') {
        repetitions = Number(content[0]);
        file = content[1];
        content = content.slice(2);
    }

    let res;

    if (datatype == '-x' || datatype == '--hex') {
        res = Buffer.from(
            content.map(x => '0x' + x.toUpperCase().padStart(2, '0'))
        );
    } else if (datatype == '-b' || datatype == '--bin') {
        res = Buffer.from(content.map(x => '0x' + parseInt(x, 2).toString(16)));
    } else if (datatype == '-t' || datatype == '--text') {
        res = Buffer.from(content.join(''), 'utf-8');
    } else if (datatype == '-n' || datatype == '--number') {
        res = Buffer.from(
            content
                .map(
                    x =>
                        parseInt(x, 10)
                            .toString(16)
                            .padStart(
                                x.toString(16).length % 2 == 0
                                    ? x.toString(16).length
                                    : x.toString(16).length + 1,
                                '0'
                            )
                            .match(/.{1,2}/g) || []
                )
                .flat()
                .map(x => '0x' + x)
        );
    } else if (datatype == '-f' || datatype == '--file') {
        try {
            res = fs.readFileSync(content.join(' ').trim());
        } catch {
            return console.log('ERROR: Content file Not Found');
        }
    } else if (datatype == '-m' || datatype == '--random') {
        res = Buffer.from([
            ...new Array(parseInt(content)).fill(0).map(() => randomByte()),
        ]);
    } else {
        return console.log('ERROR: Invalid Datatype Selected');
    }

    if (repetitions > 1) {
        res = Buffer.concat(new Array(repetitions).fill(res));
    }

    let stream, result, optype;
    if (mode == '-a' || mode == '--append') {
        optype = 'Append';
        stream = fs.createWriteStream(file, { flags: 'a' });
        result = await waitStreamWriting(stream, res);
    } else if (mode == '-w' || mode == '--write') {
        optype = 'Write';
        stream = fs.createWriteStream(file);
        result = await waitStreamWriting(stream, res);
    } else {
        return console.log('ERROR: Invalid Operation Mode');
    }

    let tmp = fs.statSync(file);
    let stat = {
        Operation: optype,
        Sucessful: result,
        'File Name': file,
        'File Size': tmp.size,
        'Data Added': res.length,
    };

    let formatted = Object.entries(stat)
        .map(x => x.join(': '))
        .join('\n');

    return console.log(formatted);
})();
