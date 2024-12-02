const fs = require('node:fs');
const path = require('node:path');

const clone = obj => {
    return JSON.parse(JSON.stringify(obj));
};

const padBothSides = (str, max, char) => {
    let toggle = false;
    while (str.length < max) {
        if (toggle) str = char + str;
        else str = str + char;
        toggle = !toggle;
    }
    return str;
};

const padBetween = (str1, str2, max, char) => {
    let final = str1;
    while (final.length + str2.length < max) {
        final += char;
    }
    return (final += str2);
};

const formatNumber = num => {
    num = num.toString();
    return num.includes('.') ? num.slice(0, num.indexOf('.') + 3) : num;
};

const walkDir = (dir = '.') => {
    let acc = [];
    (function walk(ddir) {
        fs.readdirSync(ddir).forEach(file => {
            let dpath = path.join(ddir, file);
            let stat = fs.statSync(dpath);
            let type = stat.isDirectory()
                ? 'DIRECTORY'
                : stat.isFIFO()
                ? 'FIFO'
                : stat.isSocket()
                ? 'SOCKET'
                : stat.isBlockDevice()
                ? 'BLOCK_DEVICE'
                : stat.isCharacterDevice()
                ? 'CHARACTER_DEVICE'
                : stat.isSymbolicLink()
                ? 'SYMBOLIC_LINK'
                : 'FILE';
            if (type == 'DIRECTORY') {
                // acc.push({
                //     path: '.\\' + dpath,
                //     type: type
                // });
                walk(dpath);
            } else {
                acc.push({
                    path: '.\\' + dpath,
                    type: type,
                });
            }
        });
    })(dir);
    return acc.map(x => x.path.replace('.\\', '')); //acc.map(x => (x.path.replace('.\\'+dir+'\\', '')));
};

function getSymLinkOrigin(p) {
    return path.resolve(path.dirname(p), fs.readlinkSync(p));
}

function mountPrintableLine(blockHeader) {
    // Mounting permissions line in linux style
    let permissions = [...new Array(10).fill('·')];
    if (blockHeader.type === 'BLOCK_DEVICE_FILE') permissions[0] = 'b';
    if (blockHeader.type === 'CHAR_DEVICE_FILE') permissions[0] = 'c';
    if (blockHeader.type === 'DIRECTORY') permissions[0] = 'd';
    if (blockHeader.type === 'SYM_LINK') permissions[0] = 'l';
    if (blockHeader.type === 'FIFO') permissions[0] = 'p';
    if (blockHeader.mode.TUREAD) permissions[1] = 'r';
    if (blockHeader.mode.TUWRITE) permissions[2] = 'w';
    if (blockHeader.mode.TUEXEC) permissions[3] = 'x';
    if (blockHeader.mode.TGREAD) permissions[4] = 'r';
    if (blockHeader.mode.TGWRITE) permissions[5] = 'w';
    if (blockHeader.mode.TGEXEC) permissions[6] = 'x';
    if (blockHeader.mode.TOREAD) permissions[7] = 'r';
    if (blockHeader.mode.TOWRITE) permissions[8] = 'w';
    if (blockHeader.mode.TOEXEC) permissions[9] = 'x';
    if (blockHeader.mode.TSUID) permissions[3] = 's';
    if (blockHeader.mode.TSGID) permissions[6] = 's';
    if (blockHeader.mode.TSVTX) permissions[9] = 't';
    permissions = permissions.join('');
    let mtime = new Date(Number(blockHeader.mtime)).toString().split(' ');
    mtime = [mtime[1], mtime[2], mtime[4]].join(' ');

    let final = [
        '  ' + blockHeader.id.toString().padStart(6, '·') + '  ',
        permissions + '  ',
        mtime + '  ',
        padBetween(
            blockHeader.filename,
            ' ' + blockHeader.size.toString(),
            70,
            ' '
        ),
    ];

    // Add a pointer in linux style for links
    if (blockHeader.link) final[3] += ' -> ' + blockHeader.link;
    if (blockHeader.damaged) final[3] += ' [DAMAGED]';
    if (blockHeader.filename.length >= 100) final[3] += ' [TRUNCATED]';

    return final.join('');
}

function unmountHeaderChunk(chunk) {
    const toStrippedString = buff =>
        Buffer.from([...buff].filter(x => x > 0))
            .toString('utf-8')
            .trim();
    const isUSTAREncoded = buff =>
        buff
            .subarray(257, 257 + 6)
            .toString('ascii')
            .toLowerCase() === 'ustar\x00';
    const toDecimal = string => parseInt(string, 8);
    function matchTypeFlag(type_flag) {
        return TYPE_FLAGS[type_flag.toLowerCase()] || TYPE_FLAGS['default'];
    }
    function matchFileMode(file_mode) {
        // Default for windows is 00666 -> TUREAD + TUWRITE + TGREAD + TGWRITE + TOREAD + TOWRITE
        let opt = {
            TSUID: false, // set UID on execution
            TSGID: false, // set GID on execution
            TSVTX: false, // reserved
            TUREAD: false, // read by owner
            TUWRITE: false, // write by owner
            TUEXEC: false, // execute/search by owner
            TGREAD: false, // read by group
            TGWRITE: false, // write by group
            TGEXEC: false, // execute/search by group
            TOREAD: false, // read by other
            TOWRITE: false, // write by other
            TOEXEC: false, // execute/search by other
        };
        /*
            Bits used in the mode field:
                #define TSUID    04000          set UID on execution
                #define TSGID    02000          set GID on execution
                #define TSVTX    01000          reserved
            File permissions:
                #define TUREAD   00400          read by owner
                #define TUWRITE  00200          write by owner
                #define TUEXEC   00100          execute/search by owner
                #define TGREAD   00040          read by group
                #define TGWRITE  00020          write by group
                #define TGEXEC   00010          execute/search by group
                #define TOREAD   00004          read by other
                #define TOWRITE  00002          write by other
                #define TOEXEC   00001          execute/search by other
        */
        let components = [...file_mode.padStart(6, '0')];
        // components[0] is always '0'
        // components[1] is always '0'
        switch (components[2]) {
            case '7':
                opt.TSUID = true;
                opt.TSGID = true;
                opt.TSVTX = true;
                break;
            case '6':
                opt.TSUID = true;
                opt.TSGID = true;
                break;
            case '5':
                opt.TSUID = true;
                opt.TSVTX = true;
                break;
            case '4':
                opt.TSUID = true;
                break;
            case '3':
                opt.TSGID = true;
                opt.TSVTX = true;
                break;
            case '2':
                opt.TSGID = true;
                break;
            case '1':
                opt.TSVTX = true;
                break;
        }
        switch (components[3]) {
            case '7':
                opt.TUREAD = true;
                opt.TUWRITE = true;
                opt.TUEXEC = true;
                break;
            case '6':
                opt.TUREAD = true;
                opt.TUWRITE = true;
                break;
            case '5':
                opt.TUREAD = true;
                opt.TUEXEC = true;
                break;
            case '4':
                opt.TUREAD = true;
                break;
            case '3':
                opt.TUWRITE = true;
                opt.TUEXEC = true;
                break;
            case '2':
                opt.TUWRITE = true;
                break;
            case '1':
                opt.TUEXEC = true;
                break;
        }
        switch (components[4]) {
            case '7':
                opt.TGREAD = true;
                opt.TGWRITE = true;
                opt.TGEXEC = true;
                break;
            case '6':
                opt.TGREAD = true;
                opt.TGWRITE = true;
                break;
            case '5':
                opt.TGREAD = true;
                opt.TGEXEC = true;
                break;
            case '4':
                opt.TGREAD = true;
                break;
            case '3':
                opt.TGWRITE = true;
                opt.TGEXEC = true;
                break;
            case '2':
                opt.TGWRITE = true;
                break;
            case '1':
                opt.TGEXEC = true;
                break;
        }
        switch (components[5]) {
            case '7':
                opt.TOREAD = true;
                opt.TOWRITE = true;
                opt.TOEXEC = true;
                break;
            case '6':
                opt.TOREAD = true;
                opt.TOWRITE = true;
                break;
            case '5':
                opt.TOREAD = true;
                opt.TOEXEC = true;
                break;
            case '4':
                opt.TOREAD = true;
                break;
            case '3':
                opt.TOWRITE = true;
                opt.TOEXEC = true;
                break;
            case '2':
                opt.TOWRITE = true;
                break;
            case '1':
                opt.TOEXEC = true;
                break;
        }
        return opt;
    }

    let temp = {};
    temp.damaged = false; // used for checksum checking

    temp.filename = chunk.subarray(0, 100); // The file name
    temp.filename = toStrippedString(temp.filename); // as an ASCII null-stripped string

    temp.mode = chunk.subarray(100, 100 + 8); // The file's CHMOD
    temp.mode = toStrippedString(temp.mode); // as an ASCII null-stripped string
    temp.mode = matchFileMode(temp.mode);

    temp.uid = chunk.subarray(108, 108 + 8); // The file's Owner User ID (UID)
    temp.uid = toDecimal(toStrippedString(temp.uid)); // as a decimal number (from a ASCII null-stripped string)

    temp.gid = chunk.subarray(116, 116 + 8); // The file's Owner Group ID (GID)
    temp.gid = toDecimal(toStrippedString(temp.gid)); // as a decimal number (from a ASCII null-stripped string)

    temp.size = chunk.subarray(124, 124 + 12); // The file size (in octal)
    temp.size = toDecimal(toStrippedString(temp.size)); // as a decimal number (from a ASCII null-stripped string)

    temp.mtime = chunk.subarray(136, 136 + 12); // The last modification time
    temp.mtime = toDecimal(toStrippedString(temp.mtime)); // as a decimal number (from a ASCII null-stripped string)

    temp.checksum = chunk.subarray(148, 148 + 8); // The header checksum
    temp.checksum = toDecimal(toStrippedString(temp.checksum)); // as a decimal number (from a ASCII null-stripped string)

    temp.type = chunk.subarray(156, 156 + 1); // The file type flag
    temp.type = toStrippedString(temp.type); // as an ASCII null-stripped string
    temp.type = matchTypeFlag(temp.type);

    temp.link = chunk.subarray(157, 157 + 100); // A link path (used only if it TYPE_FLAG is a link)
    temp.link = toStrippedString(temp.link); // as an ASCII null-stripped string

    temp.ustar = isUSTAREncoded(chunk); // NON-USTAR format signature - legacy only

    if (temp.ustar) {
        // skip the USTAR signature and the USTAR version token moving csb to 265
        temp.uname = chunk.subarray(265, 265 + 32); // The Owner User Name
        temp.uname = toStrippedString(temp.uname); // as an ASCII null-stripped string

        temp.gname = chunk.subarray(297, 297 + 32); // The Owner Group Name
        temp.gname = toStrippedString(temp.gname); // as an ASCII null-stripped string

        temp.devmajor = chunk.subarray(329, 329 + 8); // The device major version number
        temp.devmajor = toDecimal(toStrippedString(temp.devmajor)); // as a decimal number (from a ASCII null-stripped string)

        temp.devminor = chunk.subarray(337, 337 + 8); // The device major version number
        temp.devminor = toDecimal(toStrippedString(temp.devminor)); // as a decimal number (from a ASCII null-stripped string)

        temp.devnum = temp.devmajor + '.' + temp.devminor;

        temp.prefix = chunk.subarray(345, 345 + 155); // File prefix
        temp.prefix = toStrippedString(temp.prefix); // as an ASCII null-stripped string
    }

    // The calculated_checksum is the value the header checksum SHOULD have
    // - not the one it ACTUALLY has, so checksum verification can be done
    let calculated_checksum =
        [...chunk.subarray(0, 512)].reduce((a, c) => a + c) +
        32 * 8 -
        [...chunk.subarray(148, 148 + 8)].reduce((a, c) => a + c);
    if (calculated_checksum !== temp.checksum) temp.damaged = true;

    return temp;
}

function mountHeaderChunk(filepath) {
    const padBuffer = (maxSize, buff = Buffer.from([0x0])) => {
        let newbuff;
        // If the buff is too long, truncate it
        if (buff.length > maxSize)
            console.log(
                ' >> Warn: Filenames with more than 100 characters are not allowed. Truncating:',
                filepath,
                '->',
                buff.subarray(0, maxSize).toString()
            );
        if (buff.length > maxSize) newbuff = buff.subarray(0, maxSize);
        else newbuff = buff;
        const sz = maxSize - newbuff.length >= 0 ? maxSize - newbuff.length : 0;
        return Buffer.concat([newbuff, Buffer.from(new Array(sz).fill(0x0))]);
    };
    let stats = fs.statSync(filepath);
    let lstats = fs.lstatSync(filepath);
    let typeflag = '';
    if (stats.isFile()) typeflag = '0';
    else if (stats.isFIFO()) typeflag = '6';
    else if (stats.isDirectory()) typeflag = '5';
    else if (stats.isBlockDevice()) typeflag = '4';
    else if (lstats.isSymbolicLink()) typeflag = '2';
    else if (stats.isCharacterDevice()) typeflag = '3';
    else if (stats.nlink > 1) typeflag = '1';
    let nameOfLinked = lstats.isSymbolicLink()
        ? getSymLinkOrigin(filepath)
        : '';
    let finalpath = '';
    if (filepath.includes(process.cwd())) {
        finalpath = filepath
            .replace(process.cwd(), '')
            .replace('\\', '/')
            .slice(1);
    } else {
        finalpath = filepath.replace('\\', '/');
        finalpath = finalpath.slice(finalpath.lastIndexOf('/') + 1);
    }

    let sectors = [];
    sectors.push(padBuffer(100, Buffer.from(finalpath))); // 0	        100	    File name
    sectors.push(
        padBuffer(
            8,
            Buffer.from(stats.mode.toString(8).padStart(6, '0').padEnd(7, ' '))
        )
    ); //  100	    8	    File mode (octal)
    sectors.push(
        padBuffer(
            8,
            Buffer.from(stats.uid.toString(8).padStart(6, '0').padEnd(7, ' '))
        )
    ); //  108	    8	    Owner's numeric user ID (octal)
    sectors.push(
        padBuffer(
            8,
            Buffer.from(stats.gid.toString(8).padStart(6, '0').padEnd(7, ' '))
        )
    ); //  116	    8	    Group's numeric user ID (octal)
    sectors.push(
        padBuffer(
            12,
            Buffer.from(stats.size.toString(8).padStart(11, '0') + '\x00')
        )
    ); //  124	    12	    File size in bytes (octal)
    sectors.push(padBuffer(8)); //  136	    12	    Last modification time in numeric Unix time format (octal)
    sectors.push(padBuffer(8, Buffer.from(new Array(8).fill(0x20)))); //  148	    8	    Checksum for header record
    sectors.push(Buffer.from(typeflag)); //  156	    1	    type flag
    sectors.push(padBuffer(100, Buffer.from(nameOfLinked))); //  157	    100	    Name of linked file
    sectors.push(padBuffer(6, Buffer.from('ustar'))); //  257	    6	    UStar indicator, "ustar", then NUL
    sectors.push(Buffer.from('00')); //  263	    2	    UStar version, "00"
    sectors.push(padBuffer(32)); //  265	    32	    Owner user name (saved as 'null' for privacy)
    sectors.push(padBuffer(32)); //  297	    32	    Owner group name (saved as 'null' for privacy)
    sectors.push(padBuffer(8)); //  329	    8	    Device major number (saved as 'null' for privacy)
    sectors.push(padBuffer(8)); //  337	    8	    Device minor number (saved as 'null' for privacy)
    sectors.push(padBuffer(155)); //  345	    155	    Filename prefix
    sectors.push(padBuffer(12)); //  500     12      Just an ampty buffer for block padding (it must reach 512 bytes)

    let unixtime = Buffer.concat([
        Buffer.from(Math.ceil(stats.mtimeMs / 1000).toString(8)),
        Buffer.from([0x0]),
    ]);
    sectors[5] = unixtime;

    let checksum = [...Buffer.concat(sectors)]
        .reduce((a, c) => a + c)
        .toString(8);
    sectors[6] = Buffer.concat([
        Buffer.from(checksum.padStart(6, '0')),
        Buffer.from([0]),
        Buffer.from(' '),
    ]);

    return Buffer.concat(sectors);
}

const TYPE_FLAGS = {
    1: 'HARD_LINK',
    2: 'SYM_LINK',
    3: 'CHAR_DEVICE_FILE',
    4: 'BLOCK_DEVICE_FILE',
    5: 'DIRECTORY',
    6: 'FIFO',
    7: 'CONTIGUOUS_FILE',
    g: 'GLOBAL_EXT_HEADER',
    x: 'NEXT_EXT_HEADER',
    0: 'FILE',
    '\x00': 'FILE',
    A: 'VENDOR_SPECIFIC',
    B: 'VENDOR_SPECIFIC',
    C: 'VENDOR_SPECIFIC',
    D: 'VENDOR_SPECIFIC',
    E: 'VENDOR_SPECIFIC',
    F: 'VENDOR_SPECIFIC',
    G: 'VENDOR_SPECIFIC',
    H: 'VENDOR_SPECIFIC',
    I: 'VENDOR_SPECIFIC',
    J: 'VENDOR_SPECIFIC',
    K: 'VENDOR_SPECIFIC',
    L: 'VENDOR_SPECIFIC',
    M: 'VENDOR_SPECIFIC',
    N: 'VENDOR_SPECIFIC',
    O: 'VENDOR_SPECIFIC',
    P: 'VENDOR_SPECIFIC',
    Q: 'VENDOR_SPECIFIC',
    R: 'VENDOR_SPECIFIC',
    S: 'VENDOR_SPECIFIC',
    T: 'VENDOR_SPECIFIC',
    U: 'VENDOR_SPECIFIC',
    V: 'VENDOR_SPECIFIC',
    W: 'VENDOR_SPECIFIC',
    X: 'VENDOR_SPECIFIC',
    Y: 'VENDOR_SPECIFIC',
    Z: 'VENDOR_SPECIFIC',
    default: 'RESERVED',
};

function saveToDisk(basedir, blockHeader, bytes) {
    let loc = path.join(basedir, blockHeader.filename);
    let tmp = loc.slice(0, loc.lastIndexOf('\\'));

    // If base dir does not exists, fill the path
    if (blockHeader.type == 'DIRECTORY') {
        if (!fs.existsSync(loc)) {
            fs.mkdirSync(loc, { recursive: true });
        }
    } else {
        if (!fs.existsSync(tmp)) {
            fs.mkdirSync(tmp, { recursive: true });
        }
    }

    // Handle links and other item types here

    if (!fs.existsSync(loc)) {
        if (bytes.length > blockHeader.size)
            bytes = bytes.subarray(0, blockHeader.size);
        fs.writeFileSync(loc, bytes);
    } else {
        let fsize = fs.statSync(loc).size;
        if (fsize + bytes.length > blockHeader.size)
            bytes = bytes.subarray(0, blockHeader.size - fsize);
        fs.appendFileSync(loc, bytes);
    }
}

// ACTUAL ROUTINES

function listTAR(tarfilepath) {
    if (!fs.existsSync(tarfilepath)) {
        // if file was not found
        throw new Error(`Invalid path - file not found [${tarfilepath}]`);
    }

    const filestats = fs.statSync(tarfilepath);
    const streamWaterMark = 131072;

    let blockHeader = {};
    let waitingForBlock = false;
    let blocksUntilNextFile = 0;

    let itemsFound = 0;
    let itemsDamaged = 0;
    let damagedSize = 0;
    let itemsTruncated = 0;

    if (filestats.size < 512 * 3) {
        // The minimum file size for a TAR file is 1536 (3 blocks):
        // 1024 for the final padding + 512 for the smallest object possible (a dir)
        throw new Error(
            `Invalid file size - file may be damaged or incomplete - expected at least 3 blocks (1536 bytes), found ${Math.floor(
                filestats.size / 512
            )} (${filestats.size} bytes)`
        );
    }

    if (filestats.size % 512 > 0) {
        // A TAR file must always be a multiple of 512 (base block size)
        throw new Error(
            `Invalid file size - last block may be incomplete or with trailing data - (${
                filestats.size % 512
            } inconsistent bytes)`
        );
    }

    const stream = fs.createReadStream(tarfilepath, {
        highWaterMark: streamWaterMark, // define optimized chunk size
        start: 0,
        end: filestats.size - 512 * 2 - 1, // remove the last double-block null padding in the end
    });

    // Print action header
    console.log(); // one empty line to make it look better
    console.log(
        ` ${padBothSides(
            '  ' +
                tarfilepath +
                '  ──  ' +
                formatNumber(filestats.size / 1024) +
                ' kb  ',
            109,
            '─'
        )} `
    );

    stream.on('error', function (error) {
        console.log(` >>> Error: ${error.message}`);
    });
    stream.on('end', () => {
        // Print action footer
        console.log(
            ` ${padBothSides(
                '  ' +
                    tarfilepath +
                    '  ──  ' +
                    formatNumber(filestats.size / 1024) +
                    ' kb  ',
                109,
                '─'
            )} `
        );

        console.log(
            ` >>> Total: ${itemsFound} [${formatNumber(
                filestats.size / 1024
            )} kb]`
        );
        console.log(
            ` >>> Damaged: ${itemsDamaged}/${itemsFound} (${
                Math.ceil((itemsDamaged / itemsFound) * 100) || 0
            }%) [${formatNumber(damagedSize / 1024)} kb]`
        );
        if (itemsTruncated > 0)
            console.log(
                ` >>> Truncated filenames: ${itemsTruncated}/${itemsFound} (${
                    Math.ceil((itemsTruncated / itemsFound) * 100) || 0
                }%)`
            );
    });
    stream.on('data', chunk => {
        // Split chunk in smaller TAR chunks (512 bytes each)
        let subchunks = [];
        for (let i = 0; i < chunk.length; i += 512) {
            subchunks.push(chunk.subarray(i, i + 512));
        }

        for (let i = 0; i < subchunks.length; i++) {
            if (waitingForBlock) {
                blocksUntilNextFile--;

                if (blocksUntilNextFile <= 0) {
                    itemsFound++;
                    blockHeader.id = itemsFound;
                    if (blockHeader.damaged) {
                        itemsDamaged++;
                        damagedSize += blockHeader.size;
                    }
                    console.log(mountPrintableLine(clone(blockHeader)));
                    waitingForBlock = false;
                }

                if (blocksUntilNextFile >= 0) continue;
            }

            // If not waiting for a block, then it is a header chunk or a directory empty chunk
            blockHeader = unmountHeaderChunk(subchunks[i]);
            blocksUntilNextFile = Math.ceil(blockHeader.size / 512);
            if (blocksUntilNextFile >= 0) waitingForBlock = true;
            if (blockHeader.filename.length >= 100) itemsTruncated++;
        }
    });
}

function extractTAR(tarfilepath) {
    if (!fs.existsSync(tarfilepath)) {
        // if file was not found
        throw new Error(`Invalid path - file not found [${tarfilepath}]`);
    }

    const filestats = fs.statSync(tarfilepath);
    const streamWaterMark = 131072;
    const pathtemplate =
        tarfilepath.slice(0, tarfilepath.lastIndexOf('.')) + '\\';

    let blockHeader = {};
    let waitingForBlock = false;
    let blocksUntilNextFile = 0;
    let allowedToWrite = true;
    let cache = []; // accumulates some chunks - for executing less appending operations

    let itemsExtracted = 0;
    let itemsFound = 0;
    let itemsDamaged = 0;
    let extractedSize = 0;
    let damagedSize = 0;
    let itemsTruncated = 0;

    if (filestats.size < 512 * 3) {
        // The minimum file size for a TAR file is 1536 (3 blocks):
        // 1024 for the final padding + 512 for the smallest object possible (a dir)
        throw new Error(
            `Invalid file size - file may be damaged or incomplete - expected at least 3 blocks (1536 bytes), found ${Math.floor(
                filestats.size / 512
            )} (${filestats.size} bytes)`
        );
    }

    if (filestats.size % 512 > 0) {
        // A TAR file must always be a multiple of 512 (base block size)
        throw new Error(
            `Invalid file size - last block may be incomplete or with trailing data - (${
                filestats.size % 512
            } inconsistent bytes)`
        );
    }

    const stream = fs.createReadStream(tarfilepath, {
        highWaterMark: streamWaterMark, // define optimized chunk size
        start: 0,
        end: filestats.size - 512 * 2 - 1, // remove the last double-block null padding in the end
    });

    // Print action header
    console.log(); // one empty line to make it look better
    console.log(
        ` ${padBothSides(
            '  ' +
                tarfilepath +
                '  ──  ' +
                formatNumber(filestats.size / 1024) +
                ' kb  ',
            109,
            '─'
        )} `
    );

    stream.on('error', function (error) {
        console.log(` >>> Error: ${error.message}`);
    });
    stream.on('end', () => {
        // Print action footer
        console.log(
            ` ${padBothSides(
                '  ' +
                    tarfilepath +
                    '  ──  ' +
                    formatNumber(filestats.size / 1024) +
                    ' kb  ',
                109,
                '─'
            )} `
        );

        console.log(
            ` >>> Total: ${itemsFound} [${formatNumber(
                filestats.size / 1024
            )} kb]`
        );
        console.log(
            ` >>> Extracted: ${itemsExtracted}/${itemsFound} (${
                Math.ceil((itemsExtracted / itemsFound) * 100) || 0
            }%) [${formatNumber(extractedSize / 1024)} kb]`
        );
        console.log(
            ` >>> Damaged: ${itemsDamaged}/${itemsFound} (${
                Math.ceil((itemsDamaged / itemsFound) * 100) || 0
            }%) [${formatNumber(damagedSize / 1024)} kb]`
        );
        if (itemsTruncated > 0)
            console.log(
                ` >>> Truncated filenames: ${itemsTruncated}/${itemsFound} (${
                    Math.ceil((itemsTruncated / itemsFound) * 100) || 0
                }%)`
            );
    });
    stream.on('data', chunk => {
        // Split chunk in smaller TAR chunks (512 bytes each)
        let subchunks = [];
        for (let i = 0; i < chunk.length; i += 512) {
            subchunks.push(chunk.subarray(i, i + 512));
        }

        for (let i = 0; i < subchunks.length; i++) {
            // If waiting for a block, appends data to file
            if (waitingForBlock) {
                blocksUntilNextFile--;
                cache.push(subchunks[i]);

                // if the cache get too big (20480 * 512 = 10MB), writes to file and clears cache
                if (cache.length > 20480 || blocksUntilNextFile <= 0) {
                    if (allowedToWrite)
                        saveToDisk(
                            pathtemplate,
                            blockHeader,
                            Buffer.concat(cache)
                        );
                    cache = [];
                }

                if (blocksUntilNextFile <= 0) {
                    if (blockHeader.damaged) {
                        itemsDamaged++;
                        damagedSize += blockHeader.size;
                    }
                    extractedSize += blockHeader.size;
                    itemsExtracted++;
                    itemsFound++;
                    blockHeader.id = itemsFound;
                    console.log(mountPrintableLine(clone(blockHeader)));
                    waitingForBlock = false;
                    if (blockHeader.filename.length >= 100) itemsTruncated++;
                    blockHeader = {};
                }
            }

            // If not waiting for a block, then it is a header chunk
            else {
                blockHeader = unmountHeaderChunk(subchunks[i]);
                allowedToWrite = false;
                if (
                    fs.existsSync(path.join(pathtemplate, blockHeader.filename))
                ) {
                    allowedToWrite = false; // if file exists dont overrite or append to it
                } else {
                    allowedToWrite = true;
                }
                blocksUntilNextFile = Math.ceil(blockHeader.size / 512);
                if (blocksUntilNextFile > 0) waitingForBlock = true; // skip zero-block items
            }
        }
    });
}

async function appendTAR(tarfilepath, sources) {
    // sources must be an array of resolved file paths
    if (!fs.existsSync(tarfilepath)) {
        // if file was not found
        throw new Error(`Invalid path - file not found [${tarfilepath}]`);
    }

    const filestats = fs.statSync(tarfilepath);
    const streamWaterMark = 131072;

    let itemsFound = 0;
    let bytesAdded = 0;
    let itemsTruncated = 0;

    if (filestats.size < 512 * 3) {
        // The minimum file size for a TAR file is 1536 (3 blocks):
        // 1024 for the final padding + 512 for the smallest object possible (a dir)
        throw new Error(
            `Invalid file size - file may be damaged or incomplete - expected at least 3 blocks (1536 bytes), found ${Math.floor(
                filestats.size / 512
            )} (${filestats.size} bytes)`
        );
    }

    if (filestats.size % 512 > 0) {
        // A TAR file must always be a multiple of 512 (base block size)
        throw new Error(
            `Invalid file size - last block may be incomplete or with trailing data - (${
                filestats.size % 512
            } inconsistent bytes)`
        );
    }

    fs.truncateSync(tarfilepath, filestats.size - 512 * 2); // remove the last 512*2 null bytes from the end of the file;

    const mainstream = fs.createWriteStream(tarfilepath, {
        highWaterMark: streamWaterMark,
        flags: 'a',
        autoClose: false,
    });
    // const mainstream = fs.createWriteStream(tarfilepath, { highWaterMark: streamWaterMark, flags: 'a+', autoClose: false } );

    // Print action header
    console.log(); // one empty line to make it look better
    console.log(
        ` ${padBothSides(
            '  ' +
                tarfilepath +
                '  ──  ' +
                formatNumber(filestats.size / 1024) +
                ' kb  ',
            109,
            '─'
        )} `
    );
    console.log('  [...]\n'); // preexisting entries will be hidden, to increase visibility

    for await (let file of sources) {
        await new Promise(resolve => {
            let headerchunk = mountHeaderChunk(file);
            let blockHeader = unmountHeaderChunk(headerchunk);
            let paddingSize = 512 - (blockHeader.size % 512);

            // Add header of new file in TAR file
            mainstream.write(headerchunk);

            // Read new file to add the actual data
            let stream = fs.createReadStream(file, {
                highWaterMark: streamWaterMark,
            });
            stream.on('error', function (error) {
                console.log(` >>> Error: ${error.message}`);
                resolve();
            });

            // Pipe data received from read stream into the TAR file
            stream.on('data', chunk => {
                mainstream.write(chunk);
            });

            stream.on('end', () => {
                // Print success message for this file
                itemsFound++;
                bytesAdded += blockHeader.size + paddingSize;
                blockHeader.id = itemsFound;
                if (blockHeader.filename.length >= 100) itemsTruncated++;
                console.log(mountPrintableLine(clone(blockHeader)));

                // Pad chunk size with zeroes
                if (paddingSize > 0)
                    mainstream.write(
                        Buffer.from(new Array(paddingSize).fill(0x0))
                    );

                // Resolve, to go to next file
                resolve();
            });
        });
    }

    // Push the last null double block into stream
    mainstream.write(Buffer.from(new Array(512 * 2).fill(0x0)));

    mainstream.close(() => {
        // Print action footer
        console.log(
            ` ${padBothSides(
                '  ' +
                    tarfilepath +
                    '  ──  ' +
                    formatNumber(filestats.size / 1024) +
                    ' kb  ',
                109,
                '─'
            )} `
        );
        console.log(
            ` >>> Added: ${itemsFound} [${formatNumber(bytesAdded / 1024)} kb]`
        );
        if (itemsTruncated > 0)
            console.log(
                ` >>> Truncated filenames: ${itemsTruncated}/${itemsFound} (${
                    Math.ceil((itemsTruncated / itemsFound) * 100) || 0
                }%)`
            );
    });
}

async function createTAR(tarfilepath, sources) {
    // sources must be an array of resolved file paths
    const streamWaterMark = 131072;

    let itemsFound = 0;
    let bytesAdded = 0;
    let itemsDamaged = 0;
    let itemsTruncated = 0;
    let damagedSize = 0;

    // Create file and full path if it does not exist
    if (!fs.existsSync(tarfilepath)) {
        if (tarfilepath.includes('\\')) {
            let tmp = tarfilepath.slice(0, tarfilepath.lastIndexOf('\\'));
            // If dir does not exist, fill path
            if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
        }
        // Create file
        fs.writeFileSync(tarfilepath, Buffer.from(''));
    }

    const filestats = fs.statSync(tarfilepath);
    const mainstream = fs.createWriteStream(tarfilepath, {
        highWaterMark: streamWaterMark,
        autoClose: false,
    });

    // Print action header
    console.log(); // one empty line to make it look better
    console.log(
        ` ${padBothSides(
            '  ' +
                tarfilepath +
                '  ──  ' +
                formatNumber(filestats.size / 1024) +
                ' kb  ',
            109,
            '─'
        )} `
    );

    for await (let file of sources) {
        await new Promise(resolve => {
            let headerchunk = mountHeaderChunk(file);
            let blockHeader = unmountHeaderChunk(headerchunk);
            let paddingSize = 512 - (blockHeader.size % 512);

            if (blockHeader.filename.length >= 100) itemsTruncated++;

            // Add header of new file in TAR file
            mainstream.write(headerchunk);

            // Read new file to add the actual data
            let stream = fs.createReadStream(file, {
                highWaterMark: streamWaterMark,
            });
            stream.on('error', function (error) {
                console.log(` >>> Error: ${error.message}`);
                resolve();
            });

            // Pipe data received from read stream into the TAR file
            stream.on('data', chunk => {
                mainstream.write(chunk);
            });

            stream.on('end', () => {
                // Print success message for this file
                itemsFound++;
                bytesAdded += blockHeader.size + paddingSize;
                blockHeader.id = itemsFound;
                if (blockHeader.damaged) {
                    itemsDamaged++;
                    damagedSize += blockHeader.size;
                }
                console.log(mountPrintableLine(clone(blockHeader)));

                // Pad chunk size with zeroes
                if (paddingSize > 0)
                    mainstream.write(
                        Buffer.from(new Array(paddingSize).fill(0x0))
                    );

                // Resolve, to go to next file
                resolve();
            });
        });
    }

    // Push the last null double block into stream
    mainstream.write(Buffer.from(new Array(512 * 2).fill(0x0)));

    mainstream.close(() => {
        // Print action footer
        console.log(
            ` ${padBothSides(
                '  ' +
                    tarfilepath +
                    '  ──  ' +
                    formatNumber(filestats.size / 1024) +
                    ' kb  ',
                109,
                '─'
            )} `
        );
        console.log(
            ` >>> Total: ${itemsFound} [${formatNumber(
                (filestats.size + bytesAdded) / 1024
            )} kb]`
        );
        console.log(
            ` >>> Damaged: ${itemsDamaged}/${itemsFound} (${
                Math.ceil((itemsDamaged / itemsFound) * 100) || 0
            }%) [${formatNumber(damagedSize / 1024)} kb]`
        );
        if (itemsTruncated > 0)
            console.log(
                ` >>> Truncated filenames: ${itemsTruncated}/${itemsFound} (${
                    Math.ceil((itemsTruncated / itemsFound) * 100) || 0
                }%)`
            );
    });
}

const help = `
    [tarn-js]
    A (Slightly Underpowered) TAR utility in node.js

    Usage:
        tarn [options] <command> <tar-file> [source [...source]]

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.

    Commands:      Aliases:              Compatibility aliases:
        list       --list    | -l | l    -t | t
        create     --create  | -c | c    -c | c
        append     --append  | -a | a    -r | r
        extract    --extract | -e | e    -x | x

    Info:
        - For GNU-TAR compatibility, all commands includes a set of five aliases
        - Sources must be separed by a space, and can be relative or absolute 
          paths of directories, files, links (soft or hard) or other file types`;

(function () {
    // tar <verb> [options]
    // tar list <tarfile>
    // tar extract <tarfile>

    // tar create <tarfile> [-s source ...[-s source]] [-c compressionMethod]   // creates a tarfile from sources
    // tar append <tarfile> [-s source ...[-s source]]                          // add files from sources in an existing tarfile

    const args = process.argv.slice(2);

    if (args.includes('-v') || args.includes('--version'))
        return console.log(require('./package.json')?.version);

    if (args.includes('-h') || args.includes('--help'))
        return console.log(help);

    const verb = args[0];
    const tarfile = args[1] || '';
    const opts = {
        sources: [],
        rawsources: [],
    };

    if (!tarfile.endsWith('.tar') && tarfile !== '') {
        console.log(`<> Error: Expected a .TAR file, but got: [${tarfile}]`);
        return;
    }

    for (let i = 2; i < args.length; i++) {
        opts.rawsources.push(path.resolve(args[i]));
    }

    if (['h', '-h', 'help', '--help'].includes(verb)) {
        return console.log(help);
    } else if (['l', '-l', 'list', '--list', '-t', 't'].includes(verb)) {
        try {
            listTAR(tarfile);
        } catch (err) {
            console.log(`<> Error: Could not list contents of [${tarfile}]`);
            console.log('<> Message: ' + err.message);
        }
    } else if (['e', '-e', 'extract', '--extract', '-x', 'x'].includes(verb)) {
        try {
            extractTAR(tarfile);
        } catch (err) {
            console.log(`<> Error: Could not extract contents of [${tarfile}]`);
            console.log('<> Message: ' + err.message);
        }
    } else if (['a', '-a', 'append', '--append', '-r', 'r'].includes(verb)) {
        try {
            // Checks if the provided tarfile is a directory (to include all the subdirs)
            for (let src of opts.rawsources) {
                if (fs.statSync(src).isDirectory()) {
                    opts.sources.push(...walkDir(src));
                } else {
                    opts.sources.push(src);
                }
            }
            appendTAR(tarfile, opts.sources);
        } catch (err) {
            console.log(`<> Error: Could not create [${tarfile}]`);
            console.log('<> Message: ' + err.append);
        }
    } else if (['c', '-c', 'create', '--create', '-c', 'c'].includes(verb)) {
        try {
            // Checks if the provided tarfile is a directory (to include all the subdirs)
            for (let src of opts.rawsources) {
                if (fs.statSync(src).isDirectory()) {
                    opts.sources.push(...walkDir(src));
                } else {
                    opts.sources.push(src);
                }
            }
            createTAR(tarfile, opts.sources);
        } catch (err) {
            console.log(`<> Error: Could not create [${tarfile}]`);
            console.log('<> Message: ' + err.message);
        }
    } else {
        return console.log(help);
    }
})();
