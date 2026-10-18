/*
  A1 KITCHEN: QR CODE MAKER
  -------------------------
  Makes a QR code (byte mode, versions 1 to 40) with no outside library.
  Use: const qr = A1Qr.make("https://example.com", "M");
       qr.size = number of squares on each side
       qr.isDark(x, y) = true when that square is black
*/
const A1Qr = (function () {
  const ECC_CODEWORDS_PER_BLOCK = {
    L: [
      -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30,
      28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
      30, 30, 30, 30,
    ],
    M: [
      -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28,
      26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
      28, 28, 28, 28, 28,
    ],
    Q: [
      -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28,
      28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30,
      30, 30, 30, 30, 30,
    ],
    H: [
      -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28,
      28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
      30, 30, 30, 30, 30,
    ],
  };
  const NUM_ERROR_CORRECTION_BLOCKS = {
    L: [
      -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9,
      10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25,
    ],
    M: [
      -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17,
      17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47,
      49,
    ],
    Q: [
      -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20,
      23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62,
      65, 68,
    ],
    H: [
      -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25,
      25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74,
      77, 81,
    ],
  };
  const FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  function numRawDataModules(version) {
    let result = (16 * version + 128) * version + 64;
    if (version >= 2) {
      const numAlign = Math.floor(version / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (version >= 7) {
        result -= 36;
      }
    }
    return result;
  }

  function numDataCodewords(version, level) {
    return (
      Math.floor(numRawDataModules(version) / 8) -
      ECC_CODEWORDS_PER_BLOCK[level][version] *
        NUM_ERROR_CORRECTION_BLOCKS[level][version]
    );
  }

  function rsMultiply(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i -= 1) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsDivisor(degree) {
    const result = [];
    for (let i = 0; i < degree - 1; i += 1) {
      result.push(0);
    }
    result.push(1);
    let root = 1;
    for (let i = 0; i < degree; i += 1) {
      for (let j = 0; j < result.length; j += 1) {
        result[j] = rsMultiply(result[j], root);
        if (j + 1 < result.length) {
          result[j] ^= result[j + 1];
        }
      }
      root = rsMultiply(root, 0x02);
    }
    return result;
  }

  function rsRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    data.forEach((b) => {
      const factor = b ^ result.shift();
      result.push(0);
      divisor.forEach((coef, i) => {
        result[i] ^= rsMultiply(coef, factor);
      });
    });
    return result;
  }

  function utf8Bytes(text) {
    const encoded = unescape(encodeURIComponent(String(text)));
    const bytes = [];
    for (let i = 0; i < encoded.length; i += 1) {
      bytes.push(encoded.charCodeAt(i));
    }
    return bytes;
  }

  function bit(value, index) {
    return ((value >>> index) & 1) !== 0;
  }

  function make(text, levelName) {
    const level = FORMAT_BITS[levelName] === undefined ? "M" : levelName;
    const bytes = utf8Bytes(text);

    // 1. Choose the smallest version that fits
    let version = 1;
    for (; ; version += 1) {
      if (version > 40) {
        throw new Error("The text is too long for a QR code.");
      }
      const capacityBits = numDataCodewords(version, level) * 8;
      const used = 4 + (version <= 9 ? 8 : 16) + bytes.length * 8;
      if (used <= capacityBits) {
        break;
      }
    }
    const capacityBits = numDataCodewords(version, level) * 8;

    // 2. Data bits
    const bits = [];
    function append(value, length) {
      for (let i = length - 1; i >= 0; i -= 1) {
        bits.push((value >>> i) & 1);
      }
    }
    append(0x4, 4);
    append(bytes.length, version <= 9 ? 8 : 16);
    bytes.forEach((b) => append(b, 8));
    append(0, Math.min(4, capacityBits - bits.length));
    append(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) {
      append(pad, 8);
    }
    const dataCodewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let value = 0;
      for (let j = 0; j < 8; j += 1) {
        value = (value << 1) | bits[i + j];
      }
      dataCodewords.push(value);
    }

    // 3. Error correction and interleaving
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[level][version];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[level][version];
    const rawCodewords = Math.floor(numRawDataModules(version) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);
    const blocks = [];
    const divisor = rsDivisor(blockEccLen);
    for (let i = 0, k = 0; i < numBlocks; i += 1) {
      const dat = dataCodewords.slice(
        k,
        k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1),
      );
      k += dat.length;
      const ecc = rsRemainder(dat, divisor);
      if (i < numShortBlocks) {
        dat.push(0);
      }
      blocks.push(dat.concat(ecc));
    }
    const allCodewords = [];
    for (let i = 0; i < blocks[0].length; i += 1) {
      blocks.forEach((block, j) => {
        if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) {
          allCodewords.push(block[i]);
        }
      });
    }

    // 4. Draw the squares
    const size = version * 4 + 17;
    const modules = [];
    const isFunction = [];
    for (let y = 0; y < size; y += 1) {
      modules.push(new Array(size).fill(false));
      isFunction.push(new Array(size).fill(false));
    }
    function setFunction(x, y, dark) {
      modules[y][x] = dark;
      isFunction[y][x] = true;
    }
    function drawFinder(cx, cy) {
      for (let dy = -4; dy <= 4; dy += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < size && y >= 0 && y < size) {
            setFunction(x, y, dist !== 2 && dist !== 4);
          }
        }
      }
    }
    function drawAlignment(cx, cy) {
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          setFunction(
            cx + dx,
            cy + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
          );
        }
      }
    }
    function alignmentPositions() {
      if (version === 1) {
        return [];
      }
      const numAlign = Math.floor(version / 7) + 2;
      const step =
        version === 32
          ? 26
          : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
      const result = [6];
      for (let pos = size - 7; result.length < numAlign; pos -= step) {
        result.splice(1, 0, pos);
      }
      return result;
    }
    function drawFormat(mask) {
      const data = (FORMAT_BITS[level] << 3) | mask;
      let rem = data;
      for (let i = 0; i < 10; i += 1) {
        rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      }
      const formatBits = ((data << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i += 1) {
        setFunction(8, i, bit(formatBits, i));
      }
      setFunction(8, 7, bit(formatBits, 6));
      setFunction(8, 8, bit(formatBits, 7));
      setFunction(7, 8, bit(formatBits, 8));
      for (let i = 9; i < 15; i += 1) {
        setFunction(14 - i, 8, bit(formatBits, i));
      }
      for (let i = 0; i < 8; i += 1) {
        setFunction(size - 1 - i, 8, bit(formatBits, i));
      }
      for (let i = 8; i < 15; i += 1) {
        setFunction(8, size - 15 + i, bit(formatBits, i));
      }
      setFunction(8, size - 8, true);
    }
    function drawVersion() {
      if (version < 7) {
        return;
      }
      let rem = version;
      for (let i = 0; i < 12; i += 1) {
        rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      }
      const versionBits = (version << 12) | rem;
      for (let i = 0; i < 18; i += 1) {
        const dark = bit(versionBits, i);
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        setFunction(a, b, dark);
        setFunction(b, a, dark);
      }
    }

    for (let i = 0; i < size; i += 1) {
      setFunction(6, i, i % 2 === 0);
      setFunction(i, 6, i % 2 === 0);
    }
    drawFinder(3, 3);
    drawFinder(size - 4, 3);
    drawFinder(3, size - 4);
    const align = alignmentPositions();
    const count = align.length;
    for (let i = 0; i < count; i += 1) {
      for (let j = 0; j < count; j += 1) {
        const corner =
          (i === 0 && j === 0) ||
          (i === 0 && j === count - 1) ||
          (i === count - 1 && j === 0);
        if (!corner) {
          drawAlignment(align[i], align[j]);
        }
      }
    }
    drawFormat(0);
    drawVersion();

    // Place the data
    let index = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) {
        right = 5;
      }
      for (let vert = 0; vert < size; vert += 1) {
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFunction[y][x] && index < allCodewords.length * 8) {
            modules[y][x] = bit(allCodewords[index >>> 3], 7 - (index & 7));
            index += 1;
          }
        }
      }
    }

    // 5. Choose the best mask
    function applyMask(mask) {
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          let invert = false;
          switch (mask) {
            case 0:
              invert = (x + y) % 2 === 0;
              break;
            case 1:
              invert = y % 2 === 0;
              break;
            case 2:
              invert = x % 3 === 0;
              break;
            case 3:
              invert = (x + y) % 3 === 0;
              break;
            case 4:
              invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
              break;
            case 5:
              invert = ((x * y) % 2) + ((x * y) % 3) === 0;
              break;
            case 6:
              invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
              break;
            default:
              invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
              break;
          }
          if (!isFunction[y][x] && invert) {
            modules[y][x] = !modules[y][x];
          }
        }
      }
    }
    function penalty() {
      let result = 0;
      const lines = [];
      for (let y = 0; y < size; y += 1) {
        lines.push(modules[y].slice());
      }
      for (let x = 0; x < size; x += 1) {
        const column = [];
        for (let y = 0; y < size; y += 1) {
          column.push(modules[y][x]);
        }
        lines.push(column);
      }
      const finderA = [
        true,
        false,
        true,
        true,
        true,
        false,
        true,
        false,
        false,
        false,
        false,
      ];
      const finderB = finderA.slice().reverse();
      lines.forEach((line) => {
        let run = 1;
        for (let i = 1; i <= line.length; i += 1) {
          if (i < line.length && line[i] === line[i - 1]) {
            run += 1;
          } else {
            if (run >= 5) {
              result += run - 2;
            }
            run = 1;
          }
        }
        for (let i = 0; i + 11 <= line.length; i += 1) {
          const slice = line.slice(i, i + 11);
          if (
            slice.every((v, k) => v === finderA[k]) ||
            slice.every((v, k) => v === finderB[k])
          ) {
            result += 40;
          }
        }
      });
      for (let y = 0; y < size - 1; y += 1) {
        for (let x = 0; x < size - 1; x += 1) {
          const c = modules[y][x];
          if (
            c === modules[y][x + 1] &&
            c === modules[y + 1][x] &&
            c === modules[y + 1][x + 1]
          ) {
            result += 3;
          }
        }
      }
      let dark = 0;
      modules.forEach((row) =>
        row.forEach((v) => {
          if (v) {
            dark += 1;
          }
        }),
      );
      const total = size * size;
      result += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
      return result;
    }
    let bestMask = 0;
    let bestPenalty = Infinity;
    for (let mask = 0; mask < 8; mask += 1) {
      applyMask(mask);
      drawFormat(mask);
      const score = penalty();
      if (score < bestPenalty) {
        bestPenalty = score;
        bestMask = mask;
      }
      applyMask(mask);
    }
    applyMask(bestMask);
    drawFormat(bestMask);

    return {
      version: version,
      size: size,
      isDark: function (x, y) {
        return x >= 0 && x < size && y >= 0 && y < size && modules[y][x];
      },
    };
  }

  return { make: make };
})();
