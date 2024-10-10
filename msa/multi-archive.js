const fs = require('node:fs');
const path = require('node:path');
const stream = require('node:stream');

class SingleArchiveHeader {
    static #VERSION_MAJOR = 1;
    static #VERSION_MINOR = 0;
    static MAGIC_STR = 'COMPACTARCHIVE01';
    static MAX_HEADER_SIZE = 311;

    /**
     * Creates a Header object.
     * "source" may be either a buffer (for decoding a header)
     * or an objeect with all properties below (for encoding a header)
     *
     * @param {{
     * MAGIC_STR: string,
     * VERSION_MAJOR: number,
     * VERSION_MINOR: number,
     * FILE_SIZE: number,
     * FILE_MODE: number,
     * FILE_UID: number,
     * FILE_GID: number,
     * FILE_NAMESIZE: number,
     * FILE_NAME: string
     * }} source
     * @param {buffer} source
     */
    constructor(source) {
        if (Buffer.isBuffer(source)) {
            this.MAGIC_STR = source.subarray(0, 16).toString();
            this.VERSION_MAJOR = source[16];
            this.VERSION_MINOR = source[17];
            this.FILE_SIZE = source.readBigUInt64BE(34);
            this.FILE_MODE = source.readUInt32BE(42);
            this.FILE_UID = source.readUInt32BE(46);
            this.FILE_GID = source.readUInt32BE(50);
            this.FILE_NAMESIZE = source[54];
            this.FILE_NAME = source
                .subarray(55, 55 + this.FILE_NAMESIZE)
                .toString();
        } else {
            this.MAGIC_STR = source.MAGIC_STR || SingleArchiveHeader.MAGIC_STR;
            this.VERSION_MAJOR =
                source.VERSION_MAJOR || SingleArchiveHeader.#VERSION_MAJOR;
            this.VERSION_MINOR =
                source.VERSION_MINOR || SingleArchiveHeader.#VERSION_MINOR;
            this.FILE_SIZE = source.FILE_SIZE;
            this.FILE_MODE = source.FILE_MODE;
            this.FILE_UID = source.FILE_UID;
            this.FILE_GID = source.FILE_GID;
            this.FILE_NAMESIZE = source.FILE_NAME?.length;
            this.FILE_NAME = source.FILE_NAME;
        }

        this.DATA_OFFSET = 55 + this.FILE_NAMESIZE;
    }

    toBuffer() {
        const header = Buffer.alloc(55 + this.FILE_NAMESIZE);
        header.write(this.MAGIC_STR, 0);
        header.writeUInt8(this.VERSION_MAJOR, 16);
        header.writeUInt8(this.VERSION_MINOR, 17);
        // Skip the 16 reserved bytes
        header.writeBigUInt64BE(this.FILE_SIZE, 34);
        header.writeUInt32BE(this.FILE_MODE, 42);
        header.writeUInt32BE(this.FILE_UID, 46);
        header.writeUInt32BE(this.FILE_GID, 50);
        header.writeUInt8(this.FILE_NAMESIZE, 54);
        header.write(this.FILE_NAME, 55);
        return header;
    }
}

class SingleArchive {
    static #EXTENSION = '.sa';
    static Header = SingleArchiveHeader;

    /**
     * Create a SingleArchive file from an input file.
     * An optional "internalFile" parameter can be passed to use as the filename
     * inside the archive file. (This is helpful for building nested archives).
     * If the output parameter is a writable stream, instead of a path, data will be written to it.
     * @param {string} inputFile
     * @param {{internalName:string, output:string|stream.Writable}} options
     * @returns {Promise<SingleArchiveHeader>}
     */
    static async create(inputFile, { output, internalName } = {}) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(inputFile))
                reject(
                    new Error(
                        `Invalid path provided for archive creation [${inputFile}]`
                    )
                );

            // Read stats from the absolute path
            const stats = fs.statSync(path.resolve(inputFile));

            if (!stats.isFile())
                reject(
                    new Error(
                        `Invalid object provided for archive creation [${inputFile}] - only files are allowed`
                    )
                );

            const FILE_SIZE = BigInt(stats.size);
            const FILE_MODE = parseInt(stats.mode, 8);
            const FILE_UID = stats.uid;
            const FILE_GID = stats.gid;

            // Get the custom internal name, or the inputfile basename (including extension):
            // If internalName is provided:
            //   .\\somedir\\file.txt -> somedir/file.txt
            // Else
            //   C:\\somedir\\somefile.txt -> somefile.txt
            const FILE_NAME = internalName
                ? path
                      .normalize('./' + internalName)
                      .replaceAll('\\', '/')
                      .replaceAll(/\.\.\/?/gi, '')
                : path.basename(inputFile);

            const header = new SingleArchiveHeader({
                FILE_SIZE,
                FILE_MODE,
                FILE_UID,
                FILE_GID,
                FILE_NAME,
            });

            // Get the outputfile path:
            // If a custom one is provided:
            //   return custom path
            // Else:
            //   Take current CWD and original filename, and replace extension:
            //   C:\\somedir\\somefile.txt -> %CWD%/somefile.sa
            let outStream = output;

            if (!(output instanceof stream.Writable)) {
                const outFile =
                    output ||
                    path.join(
                        process.cwd(),
                        path.basename(inputFile, path.extname(inputFile))
                    ) + SingleArchive.#EXTENSION;

                const outFileBasepath = path.parse(outFile).dir;
                if (outFileBasepath && !fs.existsSync(outFileBasepath))
                    fs.mkdirSync(outFileBasepath, { recursive: true });

                outStream = fs.createWriteStream(outFile);
            }

            const inStream = fs.createReadStream(inputFile);
            outStream.write(header.toBuffer(), () =>
                inStream.pipe(outStream, { end: false })
            );
            inStream.on('close', () => resolve(header));
        });
    }

    /**
     * Extract a SingleArchive file from an input file.
     * If 'output' is not provided, the file 'internalName' property will be used
     * as base for extraction.
     * @param {string} inputFile The file to read and extract from.
     * @param {string} output An optional path to use as output.
     * @returns {Promise<SingleArchiveHeader>}
     */
    static async extract(inputFile, { output } = {}) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(path.resolve(inputFile)))
                reject(
                    new Error(
                        `Invalid path provided for archive extraction [${inputFile}]`
                    )
                );

            const stats = fs.statSync(path.resolve(inputFile));
            if (!stats.isFile())
                reject(
                    new Error(
                        `Invalid object provided for archive extraction [${inputFile}]`
                    )
                );

            const handle = fs.openSync(inputFile);
            const headerbuffer = Buffer.alloc(
                SingleArchiveHeader.MAX_HEADER_SIZE
            );
            fs.readSync(handle, headerbuffer);

            const header = new SingleArchiveHeader(headerbuffer);

            let internalName;
            let outStream = output;
            if (!(output instanceof stream.Writable)) {
                internalName = output
                    ? path.resolve(output)
                    : path.join(
                          process.cwd(),
                          path.normalize(
                              './' + header.FILE_NAME.replaceAll('\\', '/')
                          )
                      );
                const { dir } = path.parse(internalName);
                if (Boolean(dir) && !fs.existsSync(dir))
                    fs.mkdirSync(dir, { recursive: true });
                outStream = fs.createWriteStream(internalName);
            }

            const inStream = fs.createReadStream('', {
                fd: handle,
                start: header.DATA_OFFSET,
                end: parseInt(BigInt(header.DATA_OFFSET) + header.FILE_SIZE),
            });

            inStream.pipe(outStream, { end: false });
            inStream.on('close', () => {
                if (!(output instanceof stream.Writable)) {
                    fs.chmodSync(internalName, header.FILE_MODE);
                    fs.chownSync(
                        internalName,
                        header.FILE_UID,
                        header.FILE_GID
                    );
                }
                resolve(header);
            });
        });
    }

    /**
     * Reads and returns the header of a SingleArchive file.
     * @param {string} inputFile The file to read the header from.
     */
    static list(inputFile) {
        if (!fs.existsSync(path.resolve(inputFile)))
            return new Error(
                `Invalid path provided for archive listing [${inputFile}]`
            );

        const stats = fs.statSync(path.resolve(inputFile));
        if (!stats.isFile())
            return new Error(
                `Invalid object provided for archive listing [${inputFile}]`
            );

        const handle = fs.openSync(inputFile);
        const headerbuffer = Buffer.alloc(SingleArchiveHeader.MAX_HEADER_SIZE);
        fs.readSync(handle, headerbuffer);

        return new SingleArchiveHeader(headerbuffer);
    }
}

const permissionString = modenumber => {
    const st_mode = modenumber & parseInt('777', 8);
    // Define the file type flags
    const S_IFMT = 0o170000; // bit mask for the file type bit fields
    const S_IFSOCK = 0o140000; // socket
    const S_IFLNK = 0o120000; // symbolic link
    const S_IFREG = 0o100000; // regular file
    const S_IFBLK = 0o060000; // block device
    const S_IFDIR = 0o040000; // directory
    const S_IFCHR = 0o020000; // character device
    const S_IFIFO = 0o010000; // FIFO
    // Define the permission flags
    const S_ISUID = 0o4000; // set UID bit
    const S_ISGID = 0o2000; // set-group-ID bit
    const S_ISVTX = 0o1000; // sticky bit
    // const S_IRWXU = 0o0700; // owner permissions
    const S_IRUSR = 0o0400; // owner has read permission
    const S_IWUSR = 0o0200; // owner has write permission
    const S_IXUSR = 0o0100; // owner has execute permission
    // const S_IRWXG = 0o0070; // group permissions
    const S_IRGRP = 0o0040; // group has read permission
    const S_IWGRP = 0o0020; // group has write permission
    const S_IXGRP = 0o0010; // group has execute permission
    // const S_IRWXO = 0o0007; // others' permissions
    const S_IROTH = 0o0004; // others have read permission
    const S_IWOTH = 0o0002; // others have write permission
    const S_IXOTH = 0o0001; // others have execute permission
    // Determine file type
    let type = '';
    switch (st_mode & S_IFMT) {
        case S_IFSOCK:
            type = 's';
            break; // socket
        case S_IFLNK:
            type = 'l';
            break; // symbolic link
        case S_IFREG:
            type = '-';
            break; // regular file
        case S_IFBLK:
            type = 'b';
            break; // block device
        case S_IFDIR:
            type = 'd';
            break; // directory
        case S_IFCHR:
            type = 'c';
            break; // character device
        case S_IFIFO:
            type = 'p';
            break; // FIFO
        default: // if number not recognized (like in Windows), return simple '-'
            type = '-';
            break;
    }
    // Determine permissions
    const owner =
        (st_mode & S_IRUSR ? 'r' : '-') +
        (st_mode & S_IWUSR ? 'w' : '-') +
        (st_mode & S_IXUSR
            ? st_mode & S_ISUID
                ? 's'
                : 'x'
            : st_mode & S_ISUID
            ? 'S'
            : '-');
    const group =
        (st_mode & S_IRGRP ? 'r' : '-') +
        (st_mode & S_IWGRP ? 'w' : '-') +
        (st_mode & S_IXGRP
            ? st_mode & S_ISGID
                ? 's'
                : 'x'
            : st_mode & S_ISGID
            ? 'S'
            : '-');
    const others =
        (st_mode & S_IROTH ? 'r' : '-') +
        (st_mode & S_IWOTH ? 'w' : '-') +
        (st_mode & S_IXOTH
            ? st_mode & S_ISVTX
                ? 't'
                : 'x'
            : st_mode & S_ISVTX
            ? 'T'
            : '-');
    // Combine type and permissions into a string
    return type + owner + group + others;
};

class MultiArchiveHeader {
    static #MAGIC_STR = 'COMPACTARCHIVE02';
    static #VERSION_MAJOR = 1;
    static #VERSION_MINOR = 0;
    static MAX_HEADER_SIZE = 38;

    /**
     * Creates a Header object.
     * "source" may be either a buffer (for decoding a header)
     * or an objeect with all properties below (for encoding a header)
     *
     * @param {{
     * MAGIC_STR: string,
     * VERSION_MAJOR: number,
     * VERSION_MINOR: number,
     * FILE_COUNT: number
     * }} source
     * @param {buffer} source
     */
    constructor(source) {
        if (Buffer.isBuffer(source)) {
            this.MAGIC_STR = source.subarray(0, 16).toString();
            this.VERSION_MAJOR = source[16];
            this.VERSION_MINOR = source[17];
            this.FILE_COUNT = source.readUInt32BE(18);
        } else {
            this.MAGIC_STR = source.MAGIC_STR || MultiArchiveHeader.#MAGIC_STR;
            this.VERSION_MAJOR =
                source.VERSION_MAJOR || MultiArchiveHeader.#VERSION_MAJOR;
            this.VERSION_MINOR =
                source.VERSION_MINOR || MultiArchiveHeader.#VERSION_MINOR;
            this.FILE_COUNT = source.FILE_COUNT;
        }
    }

    toBuffer() {
        const header = Buffer.alloc(MultiArchiveHeader.MAX_HEADER_SIZE);
        header.write(this.MAGIC_STR, 0);
        header.writeUInt8(this.VERSION_MAJOR, 16);
        header.writeUInt8(this.VERSION_MINOR, 17);
        header.writeUInt32BE(this.FILE_COUNT, 18);
        // Skip 16 reserved bytes
        return header;
    }
}

const walkDir = (dir = '.') => {
    let acc = [];
    (function walk(ddir) {
        fs.readdirSync(ddir).forEach(file => {
            let dpath = path.join(ddir, file);
            let stat = fs.statSync(dpath);
            let type = stat.isDirectory() ? 'DIRECTORY' : 'FILE';
            if (type == 'DIRECTORY') {
                walk(dpath);
            } else {
                acc.push({
                    path: '.\\' + dpath,
                });
            }
        });
    })(dir);
    return acc.map(x => x.path.replace('.\\', '')); //acc.map(x => (x.path.replace('.\\'+dir+'\\', '')));
};

class MultiArchive {
    static #EXTENSION = '.msa';
    static Header = MultiArchiveHeader;

    /**
     * Create a MultiArchive file.
     *
     * "inputFile" must be a path string, pointing to either a file, or a directory.
     * If a directory is selected, all its files will be included
     *
     * An optional "internalBasepath" parameter can be passed to be used as
     * a base path for archived files.
     * (This is helpful for building nested archives).
     *
     * @param {string} inputFile Either a filepath or a directory path.
     * @param {string} internalName
     * @returns {Promise<MultiArchiveHeader>}
     */
    static async create(inputFile, output) {
        if (typeof inputFile !== 'string')
            throw new Error(
                `Invalid input path string. Expected String, received [${typeof inputFile}]`
            );

        if (!fs.existsSync(inputFile))
            throw new Error(
                `Invalid path provided for archive creation [${inputFile}]`
            );

        let filelist = [];
        const stats = fs.statSync(inputFile);
        if (stats.isFile()) filelist = [inputFile];
        else if (stats.isDirectory()) {
            filelist = walkDir(inputFile);
            filelist = filelist.filter(v => fs.statSync(v).isFile());
            // .map(v => path.join(inputFile, v));
        }

        const header = new MultiArchiveHeader({
            FILE_COUNT: filelist.length,
        });

        // Get the outputfile path:
        // If a custom one is provided:
        //   return custom path
        // Else:
        //   Take current CWD and original filename, and replace extension:
        //   C:\\somedir\\somefile.txt -> %CWD%/somefile.sa
        let outStream = output;
        if (!(output instanceof stream.Writable)) {
            const outFile = output || inputFile + MultiArchive.#EXTENSION;
            const outFileBasepath = path.parse(outFile).dir;
            if (outFileBasepath && !fs.existsSync(outFileBasepath))
                fs.mkdirSync(outFileBasepath, { recursive: true });
            outStream = fs.createWriteStream(outFile);
        }

        await new Promise(resolve =>
            outStream.write(header.toBuffer(), resolve)
        );

        // Second loop is for actual writing
        for (let file of filelist) {
            await SingleArchive.create(file, {
                output: outStream,
                internalName: file.slice(inputFile.length),
            });
        }

        await new Promise(resolve => outStream.end(resolve));
        return;
    }

    /**
     * Create a MultiArchive file from a list of SingleArchive instances.
     *
     * "singleArchivesList" must be an array of "SingleArchive" file paths.
     *
     * An "output" parameter must be passed.
     * It should be either a file path for writing, or an instance of stream.Writable.
     *
     * @param {string} inputFile Either a filepath or a directory path.
     * @param {string|stream.Writable} output
     * @returns {Promise<MultiArchiveHeader>}
     */
    static async createFromSingleArchives(singleArchivesList, output) {
        // Create MultiArchive header
        // Create output stream (or use the 'output' one if provided)
        // Write header to output stream
        // Start appending SingleArchive files to output stream

        if (!Array.isArray(singleArchivesList))
            throw new Error(
                `Invalid input file list. Expected Array, received [${typeof singleArchivesList}]`
            );

        if (
            output &&
            typeof output !== 'string' &&
            !(output instanceof stream.Writable)
        )
            throw new Error(
                `Invalid output parameter. Expected a string or instance of stream.Writable, received [${typeof output}]`
            );

        const magicString = SingleArchive.Header.MAGIC_STR;

        // First loop is for checking for errors
        for (let file of singleArchivesList) {
            if (!fs.existsSync(file))
                throw new Error(
                    `Invalid path provided for archive creation [${file}]`
                );
            if (!fs.statSync(file).isFile())
                throw new Error(
                    `Invalid object provided for archive creation [${file}] - only files are allowed`
                );

            const handle = fs.openSync(file);
            const magicstrBuffer = Buffer.alloc(magicString.length);
            fs.readSync(handle, magicstrBuffer, {
                length: magicString.length,
                position: 0,
            });
            if (magicstrBuffer.toString() !== magicString)
                throw new Error(
                    `Invalid MAGIC_STRING in object provided for archive creation [${file}] - only SingleArchive files are allowed`
                );
        }

        const header = new MultiArchiveHeader({
            FILE_COUNT: singleArchivesList.length,
        });

        // Get the outputfile path:
        // If a custom one is provided:
        //   return custom path
        // Else:
        //   Take current CWD and original filename, and replace extension:
        //   C:\\somedir\\somefile.txt -> %CWD%/somefile.sa
        let outStream = output;
        if (!(output instanceof stream.Writable)) {
            const outFile = output;
            const outFileBasepath = path.parse(outFile).dir;
            if (outFileBasepath && !fs.existsSync(outFileBasepath))
                fs.mkdirSync(outFileBasepath, { recursive: true });
            outStream = fs.createWriteStream(outFile);
        }

        await new Promise(resolve =>
            outStream.write(header.toBuffer(), resolve)
        );

        // Second loop is for actual writing
        for (let file of singleArchivesList) {
            await new Promise(resolve => {
                const inStream = fs.createReadStream(file);
                inStream.pipe(outStream, { end: false });
                inStream.on('end', resolve);
            });
        }

        await new Promise(resolve => outStream.end(resolve));
        return;
    }

    static async append(multiArchiveFile, inputFile, basepath) {
        if (typeof multiArchiveFile !== 'string')
            throw new Error(
                `Invalid archive path string. Expected String, received [${typeof multiArchiveFile}]`
            );
        if (typeof inputFile !== 'string')
            throw new Error(
                `Invalid input path string. Expected String, received [${typeof inputFile}]`
            );
        if (basepath && typeof basepath !== 'string')
            throw new Error(
                `Invalid base path string. Expected String, received [${typeof inputFile}]`
            );

        if (
            !fs.existsSync(multiArchiveFile) ||
            !fs.statSync(multiArchiveFile).isFile()
        )
            throw new Error(`Invalid archive provided [${multiArchiveFile}]`);
        if (!fs.existsSync(inputFile) || !fs.statSync(inputFile).isFile())
            throw new Error(`Invalid input path provided [${inputFile}]`);

        const archiveHandle = fs.openSync(
            multiArchiveFile,
            fs.constants.O_RDWR
        );
        const headerbuffer = Buffer.alloc(MultiArchiveHeader.MAX_HEADER_SIZE);
        fs.readSync(archiveHandle, headerbuffer);
        const header = new MultiArchiveHeader(headerbuffer);
        header.FILE_COUNT += 1;

        fs.writeSync(archiveHandle, header.toBuffer(), { position: 0 });

        fs.closeSync(archiveHandle);

        const outStream = fs.createWriteStream(multiArchiveFile, {
            flags: 'a',
        });

        await SingleArchive.create(inputFile, {
            output: outStream,
            internalName: path.join(basepath || '', path.basename(inputFile)),
        });

        return;
    }

    static async list(multiArchiveFile) {
        if (typeof multiArchiveFile !== 'string')
            throw new Error(
                `Invalid archive path string. Expected String, received [${typeof multiArchiveFile}]`
            );

        if (
            !fs.existsSync(multiArchiveFile) ||
            !fs.statSync(multiArchiveFile).isFile()
        )
            throw new Error(`Invalid archive provided [${multiArchiveFile}]`);

        const handle = fs.openSync(multiArchiveFile, 'r');
        const headerbuffer = Buffer.alloc(MultiArchiveHeader.MAX_HEADER_SIZE);
        fs.readSync(handle, headerbuffer, { position: 0 });

        const header = new MultiArchiveHeader(headerbuffer);
        const filecount = header.FILE_COUNT;

        let filesinside = [];
        let offset = MultiArchiveHeader.MAX_HEADER_SIZE;
        let chunkbuffer = Buffer.alloc(SingleArchive.Header.MAX_HEADER_SIZE);
        for (let i = 0; i < filecount; i++) {
            fs.readSync(handle, chunkbuffer, { position: offset });
            const tempheader = new SingleArchive.Header(chunkbuffer);
            filesinside.push(
                permissionString(tempheader.FILE_MODE) +
                    ' ' +
                    tempheader.FILE_UID +
                    ' ' +
                    tempheader.FILE_GID +
                    ' ' +
                    tempheader.FILE_SIZE +
                    ' ' +
                    tempheader.FILE_NAME
            );
            offset += parseInt(
                BigInt(
                    SingleArchive.Header.MAX_HEADER_SIZE -
                        256 +
                        tempheader.FILE_NAMESIZE
                ) + tempheader.FILE_SIZE
            );
        }

        fs.closeSync(handle);
        return filesinside.join('\n');
    }

    static async extract(multiArchiveFile, output) {
        if (typeof multiArchiveFile !== 'string')
            throw new Error(
                `Invalid archive path string. Expected String, received [${typeof multiArchiveFile}]`
            );

        if (
            !fs.existsSync(multiArchiveFile) ||
            !fs.statSync(multiArchiveFile).isFile()
        )
            throw new Error(`Invalid archive provided [${multiArchiveFile}]`);

        if (!output)
            output = path.join(
                process.cwd(),
                path.basename(multiArchiveFile, '.msa')
            );
        else {
            if (!fs.existsSync(output))
                fs.mkdirSync(output, { recursive: true });
            else if (!fs.statSync(output).isDirectory())
                throw new Error(
                    `Invalid output path provided. Expected a directory path. [${multiArchiveFile}]`
                );
        }

        const handle = fs.openSync(multiArchiveFile, 'r');
        const headerbuffer = Buffer.alloc(MultiArchiveHeader.MAX_HEADER_SIZE);
        fs.readSync(handle, headerbuffer, { position: 0 });

        const header = new MultiArchiveHeader(headerbuffer);
        const filecount = header.FILE_COUNT;

        let offset = MultiArchiveHeader.MAX_HEADER_SIZE;
        let chunkbuffer = Buffer.alloc(SingleArchive.Header.MAX_HEADER_SIZE);
        for (let i = 0; i < filecount; i++) {
            fs.readSync(handle, chunkbuffer, { position: offset });
            const tempheader = new SingleArchive.Header(chunkbuffer);

            const start = tempheader.DATA_OFFSET + offset;
            const end = parseInt(BigInt(start) + tempheader.FILE_SIZE);

            const destination = path.join(output, tempheader.FILE_NAME);
            const { dir } = path.parse(destination);
            if (Boolean(dir) && !fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });

            const inStream = fs.createReadStream(multiArchiveFile, {
                start: start,
                end: end - 1,
            });
            const outStream = fs.createWriteStream(destination);

            await new Promise(resolve => {
                inStream.on('end', () => {
                    fs.chmodSync(destination, tempheader.FILE_MODE);
                    outStream.close();
                    inStream.close();
                    resolve();
                });
                inStream.pipe(outStream);
            });

            offset = end;
            // Reset chunk buffer to not overlap accidentally
            chunkbuffer.fill(0);
        }

        fs.closeSync(handle);
        return;
    }
}

module.exports = MultiArchive;
