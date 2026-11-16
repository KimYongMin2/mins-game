import { createRequire } from "node:module";
import { createServer } from "node:http";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod, mod.exports), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var __require = /* #__PURE__ */ (() => createRequire(import.meta.url))();
//#endregion
//#region node_modules/ws/lib/constants.js
var require_constants = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const BINARY_TYPES = [
		"nodebuffer",
		"arraybuffer",
		"fragments"
	];
	const hasBlob = typeof Blob !== "undefined";
	if (hasBlob) BINARY_TYPES.push("blob");
	module.exports = {
		BINARY_TYPES,
		EMPTY_BUFFER: Buffer.alloc(0),
		GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
		hasBlob,
		kForOnEventAttribute: Symbol("kIsForOnEventAttribute"),
		kListener: Symbol("kListener"),
		kStatusCode: Symbol("status-code"),
		kWebSocket: Symbol("websocket"),
		NOOP: () => {}
	};
}));
//#endregion
//#region node_modules/ws/lib/buffer-util.js
var require_buffer_util = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { EMPTY_BUFFER } = require_constants();
	const FastBuffer = Buffer[Symbol.species];
	/**
	* Merges an array of buffers into a new buffer.
	*
	* @param {Buffer[]} list The array of buffers to concat
	* @param {Number} totalLength The total length of buffers in the list
	* @return {Buffer} The resulting buffer
	* @public
	*/
	function concat(list, totalLength) {
		if (list.length === 0) return EMPTY_BUFFER;
		if (list.length === 1) return list[0];
		const target = Buffer.allocUnsafe(totalLength);
		let offset = 0;
		for (let i = 0; i < list.length; i++) {
			const buf = list[i];
			target.set(buf, offset);
			offset += buf.length;
		}
		if (offset < totalLength) return new FastBuffer(target.buffer, target.byteOffset, offset);
		return target;
	}
	/**
	* Masks a buffer using the given mask.
	*
	* @param {Buffer} source The buffer to mask
	* @param {Buffer} mask The mask to use
	* @param {Buffer} output The buffer where to store the result
	* @param {Number} offset The offset at which to start writing
	* @param {Number} length The number of bytes to mask.
	* @public
	*/
	function _mask(source, mask, output, offset, length) {
		for (let i = 0; i < length; i++) output[offset + i] = source[i] ^ mask[i & 3];
	}
	/**
	* Unmasks a buffer using the given mask.
	*
	* @param {Buffer} buffer The buffer to unmask
	* @param {Buffer} mask The mask to use
	* @public
	*/
	function _unmask(buffer, mask) {
		for (let i = 0; i < buffer.length; i++) buffer[i] ^= mask[i & 3];
	}
	/**
	* Converts a buffer to an `ArrayBuffer`.
	*
	* @param {Buffer} buf The buffer to convert
	* @return {ArrayBuffer} Converted buffer
	* @public
	*/
	function toArrayBuffer(buf) {
		if (buf.length === buf.buffer.byteLength) return buf.buffer;
		return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
	}
	/**
	* Converts `data` to a `Buffer`.
	*
	* @param {*} data The data to convert
	* @return {Buffer} The buffer
	* @throws {TypeError}
	* @public
	*/
	function toBuffer(data) {
		toBuffer.readOnly = true;
		if (Buffer.isBuffer(data)) return data;
		let buf;
		if (data instanceof ArrayBuffer) buf = new FastBuffer(data);
		else if (ArrayBuffer.isView(data)) buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
		else {
			buf = Buffer.from(data);
			toBuffer.readOnly = false;
		}
		return buf;
	}
	module.exports = {
		concat,
		mask: _mask,
		toArrayBuffer,
		toBuffer,
		unmask: _unmask
	};
	/* istanbul ignore else  */
	if (!process.env.WS_NO_BUFFER_UTIL) try {
		const bufferUtil = __require("bufferutil");
		module.exports.mask = function(source, mask, output, offset, length) {
			if (length < 48) _mask(source, mask, output, offset, length);
			else bufferUtil.mask(source, mask, output, offset, length);
		};
		module.exports.unmask = function(buffer, mask) {
			if (buffer.length < 32) _unmask(buffer, mask);
			else bufferUtil.unmask(buffer, mask);
		};
	} catch (e) {}
}));
//#endregion
//#region node_modules/ws/lib/limiter.js
var require_limiter = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const kDone = Symbol("kDone");
	const kRun = Symbol("kRun");
	/**
	* A very simple job queue with adjustable concurrency. Adapted from
	* https://github.com/STRML/async-limiter
	*/
	var Limiter = class {
		/**
		* Creates a new `Limiter`.
		*
		* @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
		*     to run concurrently
		*/
		constructor(concurrency) {
			this[kDone] = () => {
				this.pending--;
				this[kRun]();
			};
			this.concurrency = concurrency || Infinity;
			this.jobs = [];
			this.pending = 0;
		}
		/**
		* Adds a job to the queue.
		*
		* @param {Function} job The job to run
		* @public
		*/
		add(job) {
			this.jobs.push(job);
			this[kRun]();
		}
		/**
		* Removes a job from the queue and runs it if possible.
		*
		* @private
		*/
		[kRun]() {
			if (this.pending === this.concurrency) return;
			if (this.jobs.length) {
				const job = this.jobs.shift();
				this.pending++;
				job(this[kDone]);
			}
		}
	};
	module.exports = Limiter;
}));
//#endregion
//#region node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const zlib = __require("zlib");
	const bufferUtil = require_buffer_util();
	const Limiter = require_limiter();
	const { kStatusCode } = require_constants();
	const FastBuffer = Buffer[Symbol.species];
	const TRAILER = Buffer.from([
		0,
		0,
		255,
		255
	]);
	const kPerMessageDeflate = Symbol("permessage-deflate");
	const kTotalLength = Symbol("total-length");
	const kCallback = Symbol("callback");
	const kBuffers = Symbol("buffers");
	const kError = Symbol("error");
	let zlibLimiter;
	/**
	* permessage-deflate implementation.
	*/
	var PerMessageDeflate = class {
		/**
		* Creates a PerMessageDeflate instance.
		*
		* @param {Object} [options] Configuration options
		* @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
		*     for, or request, a custom client window size
		* @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
		*     acknowledge disabling of client context takeover
		* @param {Number} [options.concurrencyLimit=10] The number of concurrent
		*     calls to zlib
		* @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
		*     use of a custom server window size
		* @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
		*     disabling of server context takeover
		* @param {Number} [options.threshold=1024] Size (in bytes) below which
		*     messages should not be compressed if context takeover is disabled
		* @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
		*     deflate
		* @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
		*     inflate
		* @param {Boolean} [isServer=false] Create the instance in either server or
		*     client mode
		* @param {Number} [maxPayload=0] The maximum allowed message length
		*/
		constructor(options, isServer, maxPayload) {
			this._maxPayload = maxPayload | 0;
			this._options = options || {};
			this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
			this._isServer = !!isServer;
			this._deflate = null;
			this._inflate = null;
			this.params = null;
			if (!zlibLimiter) {
				const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
				zlibLimiter = new Limiter(concurrency);
			}
		}
		/**
		* @type {String}
		*/
		static get extensionName() {
			return "permessage-deflate";
		}
		/**
		* Create an extension negotiation offer.
		*
		* @return {Object} Extension parameters
		* @public
		*/
		offer() {
			const params = {};
			if (this._options.serverNoContextTakeover) params.server_no_context_takeover = true;
			if (this._options.clientNoContextTakeover) params.client_no_context_takeover = true;
			if (this._options.serverMaxWindowBits) params.server_max_window_bits = this._options.serverMaxWindowBits;
			if (this._options.clientMaxWindowBits) params.client_max_window_bits = this._options.clientMaxWindowBits;
			else if (this._options.clientMaxWindowBits == null) params.client_max_window_bits = true;
			return params;
		}
		/**
		* Accept an extension negotiation offer/response.
		*
		* @param {Array} configurations The extension negotiation offers/reponse
		* @return {Object} Accepted configuration
		* @public
		*/
		accept(configurations) {
			configurations = this.normalizeParams(configurations);
			this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
			return this.params;
		}
		/**
		* Releases all resources used by the extension.
		*
		* @public
		*/
		cleanup() {
			if (this._inflate) {
				this._inflate.close();
				this._inflate = null;
			}
			if (this._deflate) {
				const callback = this._deflate[kCallback];
				this._deflate.close();
				this._deflate = null;
				if (callback) callback(/* @__PURE__ */ new Error("The deflate stream was closed while data was being processed"));
			}
		}
		/**
		*  Accept an extension negotiation offer.
		*
		* @param {Array} offers The extension negotiation offers
		* @return {Object} Accepted configuration
		* @private
		*/
		acceptAsServer(offers) {
			const opts = this._options;
			const accepted = offers.find((params) => {
				if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && !params.client_max_window_bits) return false;
				return true;
			});
			if (!accepted) throw new Error("None of the extension offers can be accepted");
			if (opts.serverNoContextTakeover) accepted.server_no_context_takeover = true;
			if (opts.clientNoContextTakeover) accepted.client_no_context_takeover = true;
			if (typeof opts.serverMaxWindowBits === "number") accepted.server_max_window_bits = opts.serverMaxWindowBits;
			if (typeof opts.clientMaxWindowBits === "number") accepted.client_max_window_bits = opts.clientMaxWindowBits;
			else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) delete accepted.client_max_window_bits;
			return accepted;
		}
		/**
		* Accept the extension negotiation response.
		*
		* @param {Array} response The extension negotiation response
		* @return {Object} Accepted configuration
		* @private
		*/
		acceptAsClient(response) {
			const params = response[0];
			if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) throw new Error("Unexpected parameter \"client_no_context_takeover\"");
			if (!params.client_max_window_bits) {
				if (typeof this._options.clientMaxWindowBits === "number") params.client_max_window_bits = this._options.clientMaxWindowBits;
			} else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) throw new Error("Unexpected or invalid parameter \"client_max_window_bits\"");
			return params;
		}
		/**
		* Normalize parameters.
		*
		* @param {Array} configurations The extension negotiation offers/reponse
		* @return {Array} The offers/response with normalized parameters
		* @private
		*/
		normalizeParams(configurations) {
			configurations.forEach((params) => {
				Object.keys(params).forEach((key) => {
					let value = params[key];
					if (value.length > 1) throw new Error(`Parameter "${key}" must have only a single value`);
					value = value[0];
					if (key === "client_max_window_bits") {
						if (value !== true) {
							const num = +value;
							if (!Number.isInteger(num) || num < 8 || num > 15) throw new TypeError(`Invalid value for parameter "${key}": ${value}`);
							value = num;
						} else if (!this._isServer) throw new TypeError(`Invalid value for parameter "${key}": ${value}`);
					} else if (key === "server_max_window_bits") {
						const num = +value;
						if (!Number.isInteger(num) || num < 8 || num > 15) throw new TypeError(`Invalid value for parameter "${key}": ${value}`);
						value = num;
					} else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
						if (value !== true) throw new TypeError(`Invalid value for parameter "${key}": ${value}`);
					} else throw new Error(`Unknown parameter "${key}"`);
					params[key] = value;
				});
			});
			return configurations;
		}
		/**
		* Decompress data. Concurrency limited.
		*
		* @param {Buffer} data Compressed data
		* @param {Boolean} fin Specifies whether or not this is the last fragment
		* @param {Function} callback Callback
		* @public
		*/
		decompress(data, fin, callback) {
			zlibLimiter.add((done) => {
				this._decompress(data, fin, (err, result) => {
					done();
					callback(err, result);
				});
			});
		}
		/**
		* Compress data. Concurrency limited.
		*
		* @param {(Buffer|String)} data Data to compress
		* @param {Boolean} fin Specifies whether or not this is the last fragment
		* @param {Function} callback Callback
		* @public
		*/
		compress(data, fin, callback) {
			zlibLimiter.add((done) => {
				this._compress(data, fin, (err, result) => {
					done();
					callback(err, result);
				});
			});
		}
		/**
		* Decompress data.
		*
		* @param {Buffer} data Compressed data
		* @param {Boolean} fin Specifies whether or not this is the last fragment
		* @param {Function} callback Callback
		* @private
		*/
		_decompress(data, fin, callback) {
			const endpoint = this._isServer ? "client" : "server";
			if (!this._inflate) {
				const key = `${endpoint}_max_window_bits`;
				const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
				this._inflate = zlib.createInflateRaw({
					...this._options.zlibInflateOptions,
					windowBits
				});
				this._inflate[kPerMessageDeflate] = this;
				this._inflate[kTotalLength] = 0;
				this._inflate[kBuffers] = [];
				this._inflate.on("error", inflateOnError);
				this._inflate.on("data", inflateOnData);
			}
			this._inflate[kCallback] = callback;
			this._inflate.write(data);
			if (fin) this._inflate.write(TRAILER);
			this._inflate.flush(() => {
				const err = this._inflate[kError];
				if (err) {
					this._inflate.close();
					this._inflate = null;
					callback(err);
					return;
				}
				const data = bufferUtil.concat(this._inflate[kBuffers], this._inflate[kTotalLength]);
				if (this._inflate._readableState.endEmitted) {
					this._inflate.close();
					this._inflate = null;
				} else {
					this._inflate[kTotalLength] = 0;
					this._inflate[kBuffers] = [];
					if (fin && this.params[`${endpoint}_no_context_takeover`]) this._inflate.reset();
				}
				callback(null, data);
			});
		}
		/**
		* Compress data.
		*
		* @param {(Buffer|String)} data Data to compress
		* @param {Boolean} fin Specifies whether or not this is the last fragment
		* @param {Function} callback Callback
		* @private
		*/
		_compress(data, fin, callback) {
			const endpoint = this._isServer ? "server" : "client";
			if (!this._deflate) {
				const key = `${endpoint}_max_window_bits`;
				const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
				this._deflate = zlib.createDeflateRaw({
					...this._options.zlibDeflateOptions,
					windowBits
				});
				this._deflate[kTotalLength] = 0;
				this._deflate[kBuffers] = [];
				this._deflate.on("data", deflateOnData);
			}
			this._deflate[kCallback] = callback;
			this._deflate.write(data);
			this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
				if (!this._deflate) return;
				let data = bufferUtil.concat(this._deflate[kBuffers], this._deflate[kTotalLength]);
				if (fin) data = new FastBuffer(data.buffer, data.byteOffset, data.length - 4);
				this._deflate[kCallback] = null;
				this._deflate[kTotalLength] = 0;
				this._deflate[kBuffers] = [];
				if (fin && this.params[`${endpoint}_no_context_takeover`]) this._deflate.reset();
				callback(null, data);
			});
		}
	};
	module.exports = PerMessageDeflate;
	/**
	* The listener of the `zlib.DeflateRaw` stream `'data'` event.
	*
	* @param {Buffer} chunk A chunk of data
	* @private
	*/
	function deflateOnData(chunk) {
		this[kBuffers].push(chunk);
		this[kTotalLength] += chunk.length;
	}
	/**
	* The listener of the `zlib.InflateRaw` stream `'data'` event.
	*
	* @param {Buffer} chunk A chunk of data
	* @private
	*/
	function inflateOnData(chunk) {
		this[kTotalLength] += chunk.length;
		if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
			this[kBuffers].push(chunk);
			return;
		}
		this[kError] = /* @__PURE__ */ new RangeError("Max payload size exceeded");
		this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
		this[kError][kStatusCode] = 1009;
		this.removeListener("data", inflateOnData);
		this.reset();
	}
	/**
	* The listener of the `zlib.InflateRaw` stream `'error'` event.
	*
	* @param {Error} err The emitted error
	* @private
	*/
	function inflateOnError(err) {
		this[kPerMessageDeflate]._inflate = null;
		if (this[kError]) {
			this[kCallback](this[kError]);
			return;
		}
		err[kStatusCode] = 1007;
		this[kCallback](err);
	}
}));
//#endregion
//#region node_modules/ws/lib/validation.js
var require_validation = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { isUtf8 } = __require("buffer");
	const { hasBlob } = require_constants();
	const tokenChars = [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		0,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		1,
		1,
		0,
		1,
		1,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		0,
		0,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		0,
		1,
		0,
		1,
		0
	];
	/**
	* Checks if a status code is allowed in a close frame.
	*
	* @param {Number} code The status code
	* @return {Boolean} `true` if the status code is valid, else `false`
	* @public
	*/
	function isValidStatusCode(code) {
		return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
	}
	/**
	* Checks if a given buffer contains only correct UTF-8.
	* Ported from https://www.cl.cam.ac.uk/%7Emgk25/ucs/utf8_check.c by
	* Markus Kuhn.
	*
	* @param {Buffer} buf The buffer to check
	* @return {Boolean} `true` if `buf` contains only correct UTF-8, else `false`
	* @public
	*/
	function _isValidUTF8(buf) {
		const len = buf.length;
		let i = 0;
		while (i < len) if ((buf[i] & 128) === 0) i++;
		else if ((buf[i] & 224) === 192) {
			if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) return false;
			i += 2;
		} else if ((buf[i] & 240) === 224) {
			if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || buf[i] === 237 && (buf[i + 1] & 224) === 160) return false;
			i += 3;
		} else if ((buf[i] & 248) === 240) {
			if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) return false;
			i += 4;
		} else return false;
		return true;
	}
	/**
	* Determines whether a value is a `Blob`.
	*
	* @param {*} value The value to be tested
	* @return {Boolean} `true` if `value` is a `Blob`, else `false`
	* @private
	*/
	function isBlob(value) {
		return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
	}
	module.exports = {
		isBlob,
		isValidStatusCode,
		isValidUTF8: _isValidUTF8,
		tokenChars
	};
	if (isUtf8) module.exports.isValidUTF8 = function(buf) {
		return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
	};
	else if (!process.env.WS_NO_UTF_8_VALIDATE) try {
		const isValidUTF8 = __require("utf-8-validate");
		module.exports.isValidUTF8 = function(buf) {
			return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
		};
	} catch (e) {}
}));
//#endregion
//#region node_modules/ws/lib/receiver.js
var require_receiver = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { Writable } = __require("stream");
	const PerMessageDeflate = require_permessage_deflate();
	const { BINARY_TYPES, EMPTY_BUFFER, kStatusCode, kWebSocket } = require_constants();
	const { concat, toArrayBuffer, unmask } = require_buffer_util();
	const { isValidStatusCode, isValidUTF8 } = require_validation();
	const FastBuffer = Buffer[Symbol.species];
	const GET_INFO = 0;
	const GET_PAYLOAD_LENGTH_16 = 1;
	const GET_PAYLOAD_LENGTH_64 = 2;
	const GET_MASK = 3;
	const GET_DATA = 4;
	const INFLATING = 5;
	const DEFER_EVENT = 6;
	/**
	* HyBi Receiver implementation.
	*
	* @extends Writable
	*/
	var Receiver = class extends Writable {
		/**
		* Creates a Receiver instance.
		*
		* @param {Object} [options] Options object
		* @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
		*     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
		*     multiple times in the same tick
		* @param {String} [options.binaryType=nodebuffer] The type for binary data
		* @param {Object} [options.extensions] An object containing the negotiated
		*     extensions
		* @param {Boolean} [options.isServer=false] Specifies whether to operate in
		*     client or server mode
		* @param {Number} [options.maxPayload=0] The maximum allowed message length
		* @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
		*     not to skip UTF-8 validation for text and close messages
		*/
		constructor(options = {}) {
			super();
			this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
			this._binaryType = options.binaryType || BINARY_TYPES[0];
			this._extensions = options.extensions || {};
			this._isServer = !!options.isServer;
			this._maxPayload = options.maxPayload | 0;
			this._skipUTF8Validation = !!options.skipUTF8Validation;
			this[kWebSocket] = void 0;
			this._bufferedBytes = 0;
			this._buffers = [];
			this._compressed = false;
			this._payloadLength = 0;
			this._mask = void 0;
			this._fragmented = 0;
			this._masked = false;
			this._fin = false;
			this._opcode = 0;
			this._totalPayloadLength = 0;
			this._messageLength = 0;
			this._fragments = [];
			this._errored = false;
			this._loop = false;
			this._state = GET_INFO;
		}
		/**
		* Implements `Writable.prototype._write()`.
		*
		* @param {Buffer} chunk The chunk of data to write
		* @param {String} encoding The character encoding of `chunk`
		* @param {Function} cb Callback
		* @private
		*/
		_write(chunk, encoding, cb) {
			if (this._opcode === 8 && this._state == GET_INFO) return cb();
			this._bufferedBytes += chunk.length;
			this._buffers.push(chunk);
			this.startLoop(cb);
		}
		/**
		* Consumes `n` bytes from the buffered data.
		*
		* @param {Number} n The number of bytes to consume
		* @return {Buffer} The consumed bytes
		* @private
		*/
		consume(n) {
			this._bufferedBytes -= n;
			if (n === this._buffers[0].length) return this._buffers.shift();
			if (n < this._buffers[0].length) {
				const buf = this._buffers[0];
				this._buffers[0] = new FastBuffer(buf.buffer, buf.byteOffset + n, buf.length - n);
				return new FastBuffer(buf.buffer, buf.byteOffset, n);
			}
			const dst = Buffer.allocUnsafe(n);
			do {
				const buf = this._buffers[0];
				const offset = dst.length - n;
				if (n >= buf.length) dst.set(this._buffers.shift(), offset);
				else {
					dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
					this._buffers[0] = new FastBuffer(buf.buffer, buf.byteOffset + n, buf.length - n);
				}
				n -= buf.length;
			} while (n > 0);
			return dst;
		}
		/**
		* Starts the parsing loop.
		*
		* @param {Function} cb Callback
		* @private
		*/
		startLoop(cb) {
			this._loop = true;
			do
				switch (this._state) {
					case GET_INFO:
						this.getInfo(cb);
						break;
					case GET_PAYLOAD_LENGTH_16:
						this.getPayloadLength16(cb);
						break;
					case GET_PAYLOAD_LENGTH_64:
						this.getPayloadLength64(cb);
						break;
					case GET_MASK:
						this.getMask();
						break;
					case GET_DATA:
						this.getData(cb);
						break;
					case INFLATING:
					case DEFER_EVENT:
						this._loop = false;
						return;
				}
			while (this._loop);
			if (!this._errored) cb();
		}
		/**
		* Reads the first two bytes of a frame.
		*
		* @param {Function} cb Callback
		* @private
		*/
		getInfo(cb) {
			if (this._bufferedBytes < 2) {
				this._loop = false;
				return;
			}
			const buf = this.consume(2);
			if ((buf[0] & 48) !== 0) {
				cb(this.createError(RangeError, "RSV2 and RSV3 must be clear", true, 1002, "WS_ERR_UNEXPECTED_RSV_2_3"));
				return;
			}
			const compressed = (buf[0] & 64) === 64;
			if (compressed && !this._extensions[PerMessageDeflate.extensionName]) {
				cb(this.createError(RangeError, "RSV1 must be clear", true, 1002, "WS_ERR_UNEXPECTED_RSV_1"));
				return;
			}
			this._fin = (buf[0] & 128) === 128;
			this._opcode = buf[0] & 15;
			this._payloadLength = buf[1] & 127;
			if (this._opcode === 0) {
				if (compressed) {
					cb(this.createError(RangeError, "RSV1 must be clear", true, 1002, "WS_ERR_UNEXPECTED_RSV_1"));
					return;
				}
				if (!this._fragmented) {
					cb(this.createError(RangeError, "invalid opcode 0", true, 1002, "WS_ERR_INVALID_OPCODE"));
					return;
				}
				this._opcode = this._fragmented;
			} else if (this._opcode === 1 || this._opcode === 2) {
				if (this._fragmented) {
					cb(this.createError(RangeError, `invalid opcode ${this._opcode}`, true, 1002, "WS_ERR_INVALID_OPCODE"));
					return;
				}
				this._compressed = compressed;
			} else if (this._opcode > 7 && this._opcode < 11) {
				if (!this._fin) {
					cb(this.createError(RangeError, "FIN must be set", true, 1002, "WS_ERR_EXPECTED_FIN"));
					return;
				}
				if (compressed) {
					cb(this.createError(RangeError, "RSV1 must be clear", true, 1002, "WS_ERR_UNEXPECTED_RSV_1"));
					return;
				}
				if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
					cb(this.createError(RangeError, `invalid payload length ${this._payloadLength}`, true, 1002, "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"));
					return;
				}
			} else {
				cb(this.createError(RangeError, `invalid opcode ${this._opcode}`, true, 1002, "WS_ERR_INVALID_OPCODE"));
				return;
			}
			if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
			this._masked = (buf[1] & 128) === 128;
			if (this._isServer) {
				if (!this._masked) {
					cb(this.createError(RangeError, "MASK must be set", true, 1002, "WS_ERR_EXPECTED_MASK"));
					return;
				}
			} else if (this._masked) {
				cb(this.createError(RangeError, "MASK must be clear", true, 1002, "WS_ERR_UNEXPECTED_MASK"));
				return;
			}
			if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
			else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
			else this.haveLength(cb);
		}
		/**
		* Gets extended payload length (7+16).
		*
		* @param {Function} cb Callback
		* @private
		*/
		getPayloadLength16(cb) {
			if (this._bufferedBytes < 2) {
				this._loop = false;
				return;
			}
			this._payloadLength = this.consume(2).readUInt16BE(0);
			this.haveLength(cb);
		}
		/**
		* Gets extended payload length (7+64).
		*
		* @param {Function} cb Callback
		* @private
		*/
		getPayloadLength64(cb) {
			if (this._bufferedBytes < 8) {
				this._loop = false;
				return;
			}
			const buf = this.consume(8);
			const num = buf.readUInt32BE(0);
			if (num > Math.pow(2, 21) - 1) {
				cb(this.createError(RangeError, "Unsupported WebSocket frame: payload length > 2^53 - 1", false, 1009, "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"));
				return;
			}
			this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
			this.haveLength(cb);
		}
		/**
		* Payload length has been read.
		*
		* @param {Function} cb Callback
		* @private
		*/
		haveLength(cb) {
			if (this._payloadLength && this._opcode < 8) {
				this._totalPayloadLength += this._payloadLength;
				if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
					cb(this.createError(RangeError, "Max payload size exceeded", false, 1009, "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"));
					return;
				}
			}
			if (this._masked) this._state = GET_MASK;
			else this._state = GET_DATA;
		}
		/**
		* Reads mask bytes.
		*
		* @private
		*/
		getMask() {
			if (this._bufferedBytes < 4) {
				this._loop = false;
				return;
			}
			this._mask = this.consume(4);
			this._state = GET_DATA;
		}
		/**
		* Reads data bytes.
		*
		* @param {Function} cb Callback
		* @private
		*/
		getData(cb) {
			let data = EMPTY_BUFFER;
			if (this._payloadLength) {
				if (this._bufferedBytes < this._payloadLength) {
					this._loop = false;
					return;
				}
				data = this.consume(this._payloadLength);
				if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) unmask(data, this._mask);
			}
			if (this._opcode > 7) {
				this.controlMessage(data, cb);
				return;
			}
			if (this._compressed) {
				this._state = INFLATING;
				this.decompress(data, cb);
				return;
			}
			if (data.length) {
				this._messageLength = this._totalPayloadLength;
				this._fragments.push(data);
			}
			this.dataMessage(cb);
		}
		/**
		* Decompresses data.
		*
		* @param {Buffer} data Compressed data
		* @param {Function} cb Callback
		* @private
		*/
		decompress(data, cb) {
			this._extensions[PerMessageDeflate.extensionName].decompress(data, this._fin, (err, buf) => {
				if (err) return cb(err);
				if (buf.length) {
					this._messageLength += buf.length;
					if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
						cb(this.createError(RangeError, "Max payload size exceeded", false, 1009, "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"));
						return;
					}
					this._fragments.push(buf);
				}
				this.dataMessage(cb);
				if (this._state === GET_INFO) this.startLoop(cb);
			});
		}
		/**
		* Handles a data message.
		*
		* @param {Function} cb Callback
		* @private
		*/
		dataMessage(cb) {
			if (!this._fin) {
				this._state = GET_INFO;
				return;
			}
			const messageLength = this._messageLength;
			const fragments = this._fragments;
			this._totalPayloadLength = 0;
			this._messageLength = 0;
			this._fragmented = 0;
			this._fragments = [];
			if (this._opcode === 2) {
				let data;
				if (this._binaryType === "nodebuffer") data = concat(fragments, messageLength);
				else if (this._binaryType === "arraybuffer") data = toArrayBuffer(concat(fragments, messageLength));
				else if (this._binaryType === "blob") data = new Blob(fragments);
				else data = fragments;
				if (this._allowSynchronousEvents) {
					this.emit("message", data, true);
					this._state = GET_INFO;
				} else {
					this._state = DEFER_EVENT;
					setImmediate(() => {
						this.emit("message", data, true);
						this._state = GET_INFO;
						this.startLoop(cb);
					});
				}
			} else {
				const buf = concat(fragments, messageLength);
				if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
					cb(this.createError(Error, "invalid UTF-8 sequence", true, 1007, "WS_ERR_INVALID_UTF8"));
					return;
				}
				if (this._state === INFLATING || this._allowSynchronousEvents) {
					this.emit("message", buf, false);
					this._state = GET_INFO;
				} else {
					this._state = DEFER_EVENT;
					setImmediate(() => {
						this.emit("message", buf, false);
						this._state = GET_INFO;
						this.startLoop(cb);
					});
				}
			}
		}
		/**
		* Handles a control message.
		*
		* @param {Buffer} data Data to handle
		* @return {(Error|RangeError|undefined)} A possible error
		* @private
		*/
		controlMessage(data, cb) {
			if (this._opcode === 8) {
				if (data.length === 0) {
					this._loop = false;
					this.emit("conclude", 1005, EMPTY_BUFFER);
					this.end();
				} else {
					const code = data.readUInt16BE(0);
					if (!isValidStatusCode(code)) {
						cb(this.createError(RangeError, `invalid status code ${code}`, true, 1002, "WS_ERR_INVALID_CLOSE_CODE"));
						return;
					}
					const buf = new FastBuffer(data.buffer, data.byteOffset + 2, data.length - 2);
					if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
						cb(this.createError(Error, "invalid UTF-8 sequence", true, 1007, "WS_ERR_INVALID_UTF8"));
						return;
					}
					this._loop = false;
					this.emit("conclude", code, buf);
					this.end();
				}
				this._state = GET_INFO;
				return;
			}
			if (this._allowSynchronousEvents) {
				this.emit(this._opcode === 9 ? "ping" : "pong", data);
				this._state = GET_INFO;
			} else {
				this._state = DEFER_EVENT;
				setImmediate(() => {
					this.emit(this._opcode === 9 ? "ping" : "pong", data);
					this._state = GET_INFO;
					this.startLoop(cb);
				});
			}
		}
		/**
		* Builds an error object.
		*
		* @param {function(new:Error|RangeError)} ErrorCtor The error constructor
		* @param {String} message The error message
		* @param {Boolean} prefix Specifies whether or not to add a default prefix to
		*     `message`
		* @param {Number} statusCode The status code
		* @param {String} errorCode The exposed error code
		* @return {(Error|RangeError)} The error
		* @private
		*/
		createError(ErrorCtor, message, prefix, statusCode, errorCode) {
			this._loop = false;
			this._errored = true;
			const err = new ErrorCtor(prefix ? `Invalid WebSocket frame: ${message}` : message);
			Error.captureStackTrace(err, this.createError);
			err.code = errorCode;
			err[kStatusCode] = statusCode;
			return err;
		}
	};
	module.exports = Receiver;
}));
//#endregion
//#region node_modules/ws/lib/sender.js
var require_sender = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { Duplex } = __require("stream");
	const { randomFillSync } = __require("crypto");
	const PerMessageDeflate = require_permessage_deflate();
	const { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
	const { isBlob, isValidStatusCode } = require_validation();
	const { mask: applyMask, toBuffer } = require_buffer_util();
	const kByteLength = Symbol("kByteLength");
	const maskBuffer = Buffer.alloc(4);
	const RANDOM_POOL_SIZE = 8192;
	let randomPool;
	let randomPoolPointer = RANDOM_POOL_SIZE;
	const DEFAULT = 0;
	const DEFLATING = 1;
	const GET_BLOB_DATA = 2;
	module.exports = class Sender {
		/**
		* Creates a Sender instance.
		*
		* @param {Duplex} socket The connection socket
		* @param {Object} [extensions] An object containing the negotiated extensions
		* @param {Function} [generateMask] The function used to generate the masking
		*     key
		*/
		constructor(socket, extensions, generateMask) {
			this._extensions = extensions || {};
			if (generateMask) {
				this._generateMask = generateMask;
				this._maskBuffer = Buffer.alloc(4);
			}
			this._socket = socket;
			this._firstFragment = true;
			this._compress = false;
			this._bufferedBytes = 0;
			this._queue = [];
			this._state = DEFAULT;
			this.onerror = NOOP;
			this[kWebSocket] = void 0;
		}
		/**
		* Frames a piece of data according to the HyBi WebSocket protocol.
		*
		* @param {(Buffer|String)} data The data to frame
		* @param {Object} options Options object
		* @param {Boolean} [options.fin=false] Specifies whether or not to set the
		*     FIN bit
		* @param {Function} [options.generateMask] The function used to generate the
		*     masking key
		* @param {Boolean} [options.mask=false] Specifies whether or not to mask
		*     `data`
		* @param {Buffer} [options.maskBuffer] The buffer used to store the masking
		*     key
		* @param {Number} options.opcode The opcode
		* @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
		*     modified
		* @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
		*     RSV1 bit
		* @return {(Buffer|String)[]} The framed data
		* @public
		*/
		static frame(data, options) {
			let mask;
			let merge = false;
			let offset = 2;
			let skipMasking = false;
			if (options.mask) {
				mask = options.maskBuffer || maskBuffer;
				if (options.generateMask) options.generateMask(mask);
				else {
					if (randomPoolPointer === RANDOM_POOL_SIZE) {
						/* istanbul ignore else  */
						if (randomPool === void 0) randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
						randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
						randomPoolPointer = 0;
					}
					mask[0] = randomPool[randomPoolPointer++];
					mask[1] = randomPool[randomPoolPointer++];
					mask[2] = randomPool[randomPoolPointer++];
					mask[3] = randomPool[randomPoolPointer++];
				}
				skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
				offset = 6;
			}
			let dataLength;
			if (typeof data === "string") {
				if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) dataLength = options[kByteLength];
				else {
					data = Buffer.from(data);
					dataLength = data.length;
				}
			} else {
				dataLength = data.length;
				merge = options.mask && options.readOnly && !skipMasking;
			}
			let payloadLength = dataLength;
			if (dataLength >= 65536) {
				offset += 8;
				payloadLength = 127;
			} else if (dataLength > 125) {
				offset += 2;
				payloadLength = 126;
			}
			const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
			target[0] = options.fin ? options.opcode | 128 : options.opcode;
			if (options.rsv1) target[0] |= 64;
			target[1] = payloadLength;
			if (payloadLength === 126) target.writeUInt16BE(dataLength, 2);
			else if (payloadLength === 127) {
				target[2] = target[3] = 0;
				target.writeUIntBE(dataLength, 4, 6);
			}
			if (!options.mask) return [target, data];
			target[1] |= 128;
			target[offset - 4] = mask[0];
			target[offset - 3] = mask[1];
			target[offset - 2] = mask[2];
			target[offset - 1] = mask[3];
			if (skipMasking) return [target, data];
			if (merge) {
				applyMask(data, mask, target, offset, dataLength);
				return [target];
			}
			applyMask(data, mask, data, 0, dataLength);
			return [target, data];
		}
		/**
		* Sends a close message to the other peer.
		*
		* @param {Number} [code] The status code component of the body
		* @param {(String|Buffer)} [data] The message component of the body
		* @param {Boolean} [mask=false] Specifies whether or not to mask the message
		* @param {Function} [cb] Callback
		* @public
		*/
		close(code, data, mask, cb) {
			let buf;
			if (code === void 0) buf = EMPTY_BUFFER;
			else if (typeof code !== "number" || !isValidStatusCode(code)) throw new TypeError("First argument must be a valid error code number");
			else if (data === void 0 || !data.length) {
				buf = Buffer.allocUnsafe(2);
				buf.writeUInt16BE(code, 0);
			} else {
				const length = Buffer.byteLength(data);
				if (length > 123) throw new RangeError("The message must not be greater than 123 bytes");
				buf = Buffer.allocUnsafe(2 + length);
				buf.writeUInt16BE(code, 0);
				if (typeof data === "string") buf.write(data, 2);
				else buf.set(data, 2);
			}
			const options = {
				[kByteLength]: buf.length,
				fin: true,
				generateMask: this._generateMask,
				mask,
				maskBuffer: this._maskBuffer,
				opcode: 8,
				readOnly: false,
				rsv1: false
			};
			if (this._state !== DEFAULT) this.enqueue([
				this.dispatch,
				buf,
				false,
				options,
				cb
			]);
			else this.sendFrame(Sender.frame(buf, options), cb);
		}
		/**
		* Sends a ping message to the other peer.
		*
		* @param {*} data The message to send
		* @param {Boolean} [mask=false] Specifies whether or not to mask `data`
		* @param {Function} [cb] Callback
		* @public
		*/
		ping(data, mask, cb) {
			let byteLength;
			let readOnly;
			if (typeof data === "string") {
				byteLength = Buffer.byteLength(data);
				readOnly = false;
			} else if (isBlob(data)) {
				byteLength = data.size;
				readOnly = false;
			} else {
				data = toBuffer(data);
				byteLength = data.length;
				readOnly = toBuffer.readOnly;
			}
			if (byteLength > 125) throw new RangeError("The data size must not be greater than 125 bytes");
			const options = {
				[kByteLength]: byteLength,
				fin: true,
				generateMask: this._generateMask,
				mask,
				maskBuffer: this._maskBuffer,
				opcode: 9,
				readOnly,
				rsv1: false
			};
			if (isBlob(data)) {
				if (this._state !== DEFAULT) this.enqueue([
					this.getBlobData,
					data,
					false,
					options,
					cb
				]);
				else this.getBlobData(data, false, options, cb);
			} else if (this._state !== DEFAULT) this.enqueue([
				this.dispatch,
				data,
				false,
				options,
				cb
			]);
			else this.sendFrame(Sender.frame(data, options), cb);
		}
		/**
		* Sends a pong message to the other peer.
		*
		* @param {*} data The message to send
		* @param {Boolean} [mask=false] Specifies whether or not to mask `data`
		* @param {Function} [cb] Callback
		* @public
		*/
		pong(data, mask, cb) {
			let byteLength;
			let readOnly;
			if (typeof data === "string") {
				byteLength = Buffer.byteLength(data);
				readOnly = false;
			} else if (isBlob(data)) {
				byteLength = data.size;
				readOnly = false;
			} else {
				data = toBuffer(data);
				byteLength = data.length;
				readOnly = toBuffer.readOnly;
			}
			if (byteLength > 125) throw new RangeError("The data size must not be greater than 125 bytes");
			const options = {
				[kByteLength]: byteLength,
				fin: true,
				generateMask: this._generateMask,
				mask,
				maskBuffer: this._maskBuffer,
				opcode: 10,
				readOnly,
				rsv1: false
			};
			if (isBlob(data)) {
				if (this._state !== DEFAULT) this.enqueue([
					this.getBlobData,
					data,
					false,
					options,
					cb
				]);
				else this.getBlobData(data, false, options, cb);
			} else if (this._state !== DEFAULT) this.enqueue([
				this.dispatch,
				data,
				false,
				options,
				cb
			]);
			else this.sendFrame(Sender.frame(data, options), cb);
		}
		/**
		* Sends a data message to the other peer.
		*
		* @param {*} data The message to send
		* @param {Object} options Options object
		* @param {Boolean} [options.binary=false] Specifies whether `data` is binary
		*     or text
		* @param {Boolean} [options.compress=false] Specifies whether or not to
		*     compress `data`
		* @param {Boolean} [options.fin=false] Specifies whether the fragment is the
		*     last one
		* @param {Boolean} [options.mask=false] Specifies whether or not to mask
		*     `data`
		* @param {Function} [cb] Callback
		* @public
		*/
		send(data, options, cb) {
			const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
			let opcode = options.binary ? 2 : 1;
			let rsv1 = options.compress;
			let byteLength;
			let readOnly;
			if (typeof data === "string") {
				byteLength = Buffer.byteLength(data);
				readOnly = false;
			} else if (isBlob(data)) {
				byteLength = data.size;
				readOnly = false;
			} else {
				data = toBuffer(data);
				byteLength = data.length;
				readOnly = toBuffer.readOnly;
			}
			if (this._firstFragment) {
				this._firstFragment = false;
				if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) rsv1 = byteLength >= perMessageDeflate._threshold;
				this._compress = rsv1;
			} else {
				rsv1 = false;
				opcode = 0;
			}
			if (options.fin) this._firstFragment = true;
			const opts = {
				[kByteLength]: byteLength,
				fin: options.fin,
				generateMask: this._generateMask,
				mask: options.mask,
				maskBuffer: this._maskBuffer,
				opcode,
				readOnly,
				rsv1
			};
			if (isBlob(data)) {
				if (this._state !== DEFAULT) this.enqueue([
					this.getBlobData,
					data,
					this._compress,
					opts,
					cb
				]);
				else this.getBlobData(data, this._compress, opts, cb);
			} else if (this._state !== DEFAULT) this.enqueue([
				this.dispatch,
				data,
				this._compress,
				opts,
				cb
			]);
			else this.dispatch(data, this._compress, opts, cb);
		}
		/**
		* Gets the contents of a blob as binary data.
		*
		* @param {Blob} blob The blob
		* @param {Boolean} [compress=false] Specifies whether or not to compress
		*     the data
		* @param {Object} options Options object
		* @param {Boolean} [options.fin=false] Specifies whether or not to set the
		*     FIN bit
		* @param {Function} [options.generateMask] The function used to generate the
		*     masking key
		* @param {Boolean} [options.mask=false] Specifies whether or not to mask
		*     `data`
		* @param {Buffer} [options.maskBuffer] The buffer used to store the masking
		*     key
		* @param {Number} options.opcode The opcode
		* @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
		*     modified
		* @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
		*     RSV1 bit
		* @param {Function} [cb] Callback
		* @private
		*/
		getBlobData(blob, compress, options, cb) {
			this._bufferedBytes += options[kByteLength];
			this._state = GET_BLOB_DATA;
			blob.arrayBuffer().then((arrayBuffer) => {
				if (this._socket.destroyed) {
					const err = /* @__PURE__ */ new Error("The socket was closed while the blob was being read");
					process.nextTick(callCallbacks, this, err, cb);
					return;
				}
				this._bufferedBytes -= options[kByteLength];
				const data = toBuffer(arrayBuffer);
				if (!compress) {
					this._state = DEFAULT;
					this.sendFrame(Sender.frame(data, options), cb);
					this.dequeue();
				} else this.dispatch(data, compress, options, cb);
			}).catch((err) => {
				process.nextTick(onError, this, err, cb);
			});
		}
		/**
		* Dispatches a message.
		*
		* @param {(Buffer|String)} data The message to send
		* @param {Boolean} [compress=false] Specifies whether or not to compress
		*     `data`
		* @param {Object} options Options object
		* @param {Boolean} [options.fin=false] Specifies whether or not to set the
		*     FIN bit
		* @param {Function} [options.generateMask] The function used to generate the
		*     masking key
		* @param {Boolean} [options.mask=false] Specifies whether or not to mask
		*     `data`
		* @param {Buffer} [options.maskBuffer] The buffer used to store the masking
		*     key
		* @param {Number} options.opcode The opcode
		* @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
		*     modified
		* @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
		*     RSV1 bit
		* @param {Function} [cb] Callback
		* @private
		*/
		dispatch(data, compress, options, cb) {
			if (!compress) {
				this.sendFrame(Sender.frame(data, options), cb);
				return;
			}
			const perMessageDeflate = this._extensions[PerMessageDeflate.extensionName];
			this._bufferedBytes += options[kByteLength];
			this._state = DEFLATING;
			perMessageDeflate.compress(data, options.fin, (_, buf) => {
				if (this._socket.destroyed) {
					const err = /* @__PURE__ */ new Error("The socket was closed while data was being compressed");
					callCallbacks(this, err, cb);
					return;
				}
				this._bufferedBytes -= options[kByteLength];
				this._state = DEFAULT;
				options.readOnly = false;
				this.sendFrame(Sender.frame(buf, options), cb);
				this.dequeue();
			});
		}
		/**
		* Executes queued send operations.
		*
		* @private
		*/
		dequeue() {
			while (this._state === DEFAULT && this._queue.length) {
				const params = this._queue.shift();
				this._bufferedBytes -= params[3][kByteLength];
				Reflect.apply(params[0], this, params.slice(1));
			}
		}
		/**
		* Enqueues a send operation.
		*
		* @param {Array} params Send operation parameters.
		* @private
		*/
		enqueue(params) {
			this._bufferedBytes += params[3][kByteLength];
			this._queue.push(params);
		}
		/**
		* Sends a frame.
		*
		* @param {(Buffer | String)[]} list The frame to send
		* @param {Function} [cb] Callback
		* @private
		*/
		sendFrame(list, cb) {
			if (list.length === 2) {
				this._socket.cork();
				this._socket.write(list[0]);
				this._socket.write(list[1], cb);
				this._socket.uncork();
			} else this._socket.write(list[0], cb);
		}
	};
	/**
	* Calls queued callbacks with an error.
	*
	* @param {Sender} sender The `Sender` instance
	* @param {Error} err The error to call the callbacks with
	* @param {Function} [cb] The first callback
	* @private
	*/
	function callCallbacks(sender, err, cb) {
		if (typeof cb === "function") cb(err);
		for (let i = 0; i < sender._queue.length; i++) {
			const params = sender._queue[i];
			const callback = params[params.length - 1];
			if (typeof callback === "function") callback(err);
		}
	}
	/**
	* Handles a `Sender` error.
	*
	* @param {Sender} sender The `Sender` instance
	* @param {Error} err The error
	* @param {Function} [cb] The first pending callback
	* @private
	*/
	function onError(sender, err, cb) {
		callCallbacks(sender, err, cb);
		sender.onerror(err);
	}
}));
//#endregion
//#region node_modules/ws/lib/event-target.js
var require_event_target = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { kForOnEventAttribute, kListener } = require_constants();
	const kCode = Symbol("kCode");
	const kData = Symbol("kData");
	const kError = Symbol("kError");
	const kMessage = Symbol("kMessage");
	const kReason = Symbol("kReason");
	const kTarget = Symbol("kTarget");
	const kType = Symbol("kType");
	const kWasClean = Symbol("kWasClean");
	/**
	* Class representing an event.
	*/
	var Event = class {
		/**
		* Create a new `Event`.
		*
		* @param {String} type The name of the event
		* @throws {TypeError} If the `type` argument is not specified
		*/
		constructor(type) {
			this[kTarget] = null;
			this[kType] = type;
		}
		/**
		* @type {*}
		*/
		get target() {
			return this[kTarget];
		}
		/**
		* @type {String}
		*/
		get type() {
			return this[kType];
		}
	};
	Object.defineProperty(Event.prototype, "target", { enumerable: true });
	Object.defineProperty(Event.prototype, "type", { enumerable: true });
	/**
	* Class representing a close event.
	*
	* @extends Event
	*/
	var CloseEvent = class extends Event {
		/**
		* Create a new `CloseEvent`.
		*
		* @param {String} type The name of the event
		* @param {Object} [options] A dictionary object that allows for setting
		*     attributes via object members of the same name
		* @param {Number} [options.code=0] The status code explaining why the
		*     connection was closed
		* @param {String} [options.reason=''] A human-readable string explaining why
		*     the connection was closed
		* @param {Boolean} [options.wasClean=false] Indicates whether or not the
		*     connection was cleanly closed
		*/
		constructor(type, options = {}) {
			super(type);
			this[kCode] = options.code === void 0 ? 0 : options.code;
			this[kReason] = options.reason === void 0 ? "" : options.reason;
			this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
		}
		/**
		* @type {Number}
		*/
		get code() {
			return this[kCode];
		}
		/**
		* @type {String}
		*/
		get reason() {
			return this[kReason];
		}
		/**
		* @type {Boolean}
		*/
		get wasClean() {
			return this[kWasClean];
		}
	};
	Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
	Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
	Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
	/**
	* Class representing an error event.
	*
	* @extends Event
	*/
	var ErrorEvent = class extends Event {
		/**
		* Create a new `ErrorEvent`.
		*
		* @param {String} type The name of the event
		* @param {Object} [options] A dictionary object that allows for setting
		*     attributes via object members of the same name
		* @param {*} [options.error=null] The error that generated this event
		* @param {String} [options.message=''] The error message
		*/
		constructor(type, options = {}) {
			super(type);
			this[kError] = options.error === void 0 ? null : options.error;
			this[kMessage] = options.message === void 0 ? "" : options.message;
		}
		/**
		* @type {*}
		*/
		get error() {
			return this[kError];
		}
		/**
		* @type {String}
		*/
		get message() {
			return this[kMessage];
		}
	};
	Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
	Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
	/**
	* Class representing a message event.
	*
	* @extends Event
	*/
	var MessageEvent = class extends Event {
		/**
		* Create a new `MessageEvent`.
		*
		* @param {String} type The name of the event
		* @param {Object} [options] A dictionary object that allows for setting
		*     attributes via object members of the same name
		* @param {*} [options.data=null] The message content
		*/
		constructor(type, options = {}) {
			super(type);
			this[kData] = options.data === void 0 ? null : options.data;
		}
		/**
		* @type {*}
		*/
		get data() {
			return this[kData];
		}
	};
	Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
	module.exports = {
		CloseEvent,
		ErrorEvent,
		Event,
		EventTarget: {
			/**
			* Register an event listener.
			*
			* @param {String} type A string representing the event type to listen for
			* @param {(Function|Object)} handler The listener to add
			* @param {Object} [options] An options object specifies characteristics about
			*     the event listener
			* @param {Boolean} [options.once=false] A `Boolean` indicating that the
			*     listener should be invoked at most once after being added. If `true`,
			*     the listener would be automatically removed when invoked.
			* @public
			*/
			addEventListener(type, handler, options = {}) {
				for (const listener of this.listeners(type)) if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) return;
				let wrapper;
				if (type === "message") wrapper = function onMessage(data, isBinary) {
					const event = new MessageEvent("message", { data: isBinary ? data : data.toString() });
					event[kTarget] = this;
					callListener(handler, this, event);
				};
				else if (type === "close") wrapper = function onClose(code, message) {
					const event = new CloseEvent("close", {
						code,
						reason: message.toString(),
						wasClean: this._closeFrameReceived && this._closeFrameSent
					});
					event[kTarget] = this;
					callListener(handler, this, event);
				};
				else if (type === "error") wrapper = function onError(error) {
					const event = new ErrorEvent("error", {
						error,
						message: error.message
					});
					event[kTarget] = this;
					callListener(handler, this, event);
				};
				else if (type === "open") wrapper = function onOpen() {
					const event = new Event("open");
					event[kTarget] = this;
					callListener(handler, this, event);
				};
				else return;
				wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
				wrapper[kListener] = handler;
				if (options.once) this.once(type, wrapper);
				else this.on(type, wrapper);
			},
			/**
			* Remove an event listener.
			*
			* @param {String} type A string representing the event type to remove
			* @param {(Function|Object)} handler The listener to remove
			* @public
			*/
			removeEventListener(type, handler) {
				for (const listener of this.listeners(type)) if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
					this.removeListener(type, listener);
					break;
				}
			}
		},
		MessageEvent
	};
	/**
	* Call an event listener
	*
	* @param {(Function|Object)} listener The listener to call
	* @param {*} thisArg The value to use as `this`` when calling the listener
	* @param {Event} event The event to pass to the listener
	* @private
	*/
	function callListener(listener, thisArg, event) {
		if (typeof listener === "object" && listener.handleEvent) listener.handleEvent.call(listener, event);
		else listener.call(thisArg, event);
	}
}));
//#endregion
//#region node_modules/ws/lib/extension.js
var require_extension = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { tokenChars } = require_validation();
	/**
	* Adds an offer to the map of extension offers or a parameter to the map of
	* parameters.
	*
	* @param {Object} dest The map of extension offers or parameters
	* @param {String} name The extension or parameter name
	* @param {(Object|Boolean|String)} elem The extension parameters or the
	*     parameter value
	* @private
	*/
	function push(dest, name, elem) {
		if (dest[name] === void 0) dest[name] = [elem];
		else dest[name].push(elem);
	}
	/**
	* Parses the `Sec-WebSocket-Extensions` header into an object.
	*
	* @param {String} header The field value of the header
	* @return {Object} The parsed object
	* @public
	*/
	function parse(header) {
		const offers = Object.create(null);
		let params = Object.create(null);
		let mustUnescape = false;
		let isEscaping = false;
		let inQuotes = false;
		let extensionName;
		let paramName;
		let start = -1;
		let code = -1;
		let end = -1;
		let i = 0;
		for (; i < header.length; i++) {
			code = header.charCodeAt(i);
			if (extensionName === void 0) {
				if (end === -1 && tokenChars[code] === 1) {
					if (start === -1) start = i;
				} else if (i !== 0 && (code === 32 || code === 9)) {
					if (end === -1 && start !== -1) end = i;
				} else if (code === 59 || code === 44) {
					if (start === -1) throw new SyntaxError(`Unexpected character at index ${i}`);
					if (end === -1) end = i;
					const name = header.slice(start, end);
					if (code === 44) {
						push(offers, name, params);
						params = Object.create(null);
					} else extensionName = name;
					start = end = -1;
				} else throw new SyntaxError(`Unexpected character at index ${i}`);
			} else if (paramName === void 0) {
				if (end === -1 && tokenChars[code] === 1) {
					if (start === -1) start = i;
				} else if (code === 32 || code === 9) {
					if (end === -1 && start !== -1) end = i;
				} else if (code === 59 || code === 44) {
					if (start === -1) throw new SyntaxError(`Unexpected character at index ${i}`);
					if (end === -1) end = i;
					push(params, header.slice(start, end), true);
					if (code === 44) {
						push(offers, extensionName, params);
						params = Object.create(null);
						extensionName = void 0;
					}
					start = end = -1;
				} else if (code === 61 && start !== -1 && end === -1) {
					paramName = header.slice(start, i);
					start = end = -1;
				} else throw new SyntaxError(`Unexpected character at index ${i}`);
			} else if (isEscaping) {
				if (tokenChars[code] !== 1) throw new SyntaxError(`Unexpected character at index ${i}`);
				if (start === -1) start = i;
				else if (!mustUnescape) mustUnescape = true;
				isEscaping = false;
			} else if (inQuotes) {
				if (tokenChars[code] === 1) {
					if (start === -1) start = i;
				} else if (code === 34 && start !== -1) {
					inQuotes = false;
					end = i;
				} else if (code === 92) isEscaping = true;
				else throw new SyntaxError(`Unexpected character at index ${i}`);
			} else if (code === 34 && header.charCodeAt(i - 1) === 61) inQuotes = true;
			else if (end === -1 && tokenChars[code] === 1) {
				if (start === -1) start = i;
			} else if (start !== -1 && (code === 32 || code === 9)) {
				if (end === -1) end = i;
			} else if (code === 59 || code === 44) {
				if (start === -1) throw new SyntaxError(`Unexpected character at index ${i}`);
				if (end === -1) end = i;
				let value = header.slice(start, end);
				if (mustUnescape) {
					value = value.replace(/\\/g, "");
					mustUnescape = false;
				}
				push(params, paramName, value);
				if (code === 44) {
					push(offers, extensionName, params);
					params = Object.create(null);
					extensionName = void 0;
				}
				paramName = void 0;
				start = end = -1;
			} else throw new SyntaxError(`Unexpected character at index ${i}`);
		}
		if (start === -1 || inQuotes || code === 32 || code === 9) throw new SyntaxError("Unexpected end of input");
		if (end === -1) end = i;
		const token = header.slice(start, end);
		if (extensionName === void 0) push(offers, token, params);
		else {
			if (paramName === void 0) push(params, token, true);
			else if (mustUnescape) push(params, paramName, token.replace(/\\/g, ""));
			else push(params, paramName, token);
			push(offers, extensionName, params);
		}
		return offers;
	}
	/**
	* Builds the `Sec-WebSocket-Extensions` header field value.
	*
	* @param {Object} extensions The map of extensions and parameters to format
	* @return {String} A string representing the given object
	* @public
	*/
	function format(extensions) {
		return Object.keys(extensions).map((extension) => {
			let configurations = extensions[extension];
			if (!Array.isArray(configurations)) configurations = [configurations];
			return configurations.map((params) => {
				return [extension].concat(Object.keys(params).map((k) => {
					let values = params[k];
					if (!Array.isArray(values)) values = [values];
					return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
				})).join("; ");
			}).join(", ");
		}).join(", ");
	}
	module.exports = {
		format,
		parse
	};
}));
//#endregion
//#region node_modules/ws/lib/websocket.js
var require_websocket = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const EventEmitter = __require("events");
	const https = __require("https");
	const http = __require("http");
	const net = __require("net");
	const tls = __require("tls");
	const { randomBytes, createHash } = __require("crypto");
	const { Duplex, Readable } = __require("stream");
	const { URL } = __require("url");
	const PerMessageDeflate = require_permessage_deflate();
	const Receiver = require_receiver();
	const Sender = require_sender();
	const { isBlob } = require_validation();
	const { BINARY_TYPES, EMPTY_BUFFER, GUID, kForOnEventAttribute, kListener, kStatusCode, kWebSocket, NOOP } = require_constants();
	const { EventTarget: { addEventListener, removeEventListener } } = require_event_target();
	const { format, parse } = require_extension();
	const { toBuffer } = require_buffer_util();
	const closeTimeout = 3e4;
	const kAborted = Symbol("kAborted");
	const protocolVersions = [8, 13];
	const readyStates = [
		"CONNECTING",
		"OPEN",
		"CLOSING",
		"CLOSED"
	];
	const subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
	/**
	* Class representing a WebSocket.
	*
	* @extends EventEmitter
	*/
	var WebSocket = class WebSocket extends EventEmitter {
		/**
		* Create a new `WebSocket`.
		*
		* @param {(String|URL)} address The URL to which to connect
		* @param {(String|String[])} [protocols] The subprotocols
		* @param {Object} [options] Connection options
		*/
		constructor(address, protocols, options) {
			super();
			this._binaryType = BINARY_TYPES[0];
			this._closeCode = 1006;
			this._closeFrameReceived = false;
			this._closeFrameSent = false;
			this._closeMessage = EMPTY_BUFFER;
			this._closeTimer = null;
			this._errorEmitted = false;
			this._extensions = {};
			this._paused = false;
			this._protocol = "";
			this._readyState = WebSocket.CONNECTING;
			this._receiver = null;
			this._sender = null;
			this._socket = null;
			if (address !== null) {
				this._bufferedAmount = 0;
				this._isServer = false;
				this._redirects = 0;
				if (protocols === void 0) protocols = [];
				else if (!Array.isArray(protocols)) {
					if (typeof protocols === "object" && protocols !== null) {
						options = protocols;
						protocols = [];
					} else protocols = [protocols];
				}
				initAsClient(this, address, protocols, options);
			} else {
				this._autoPong = options.autoPong;
				this._isServer = true;
			}
		}
		/**
		* For historical reasons, the custom "nodebuffer" type is used by the default
		* instead of "blob".
		*
		* @type {String}
		*/
		get binaryType() {
			return this._binaryType;
		}
		set binaryType(type) {
			if (!BINARY_TYPES.includes(type)) return;
			this._binaryType = type;
			if (this._receiver) this._receiver._binaryType = type;
		}
		/**
		* @type {Number}
		*/
		get bufferedAmount() {
			if (!this._socket) return this._bufferedAmount;
			return this._socket._writableState.length + this._sender._bufferedBytes;
		}
		/**
		* @type {String}
		*/
		get extensions() {
			return Object.keys(this._extensions).join();
		}
		/**
		* @type {Boolean}
		*/
		get isPaused() {
			return this._paused;
		}
		/**
		* @type {Function}
		*/
		/* istanbul ignore next */
		get onclose() {
			return null;
		}
		/**
		* @type {Function}
		*/
		/* istanbul ignore next */
		get onerror() {
			return null;
		}
		/**
		* @type {Function}
		*/
		/* istanbul ignore next */
		get onopen() {
			return null;
		}
		/**
		* @type {Function}
		*/
		/* istanbul ignore next */
		get onmessage() {
			return null;
		}
		/**
		* @type {String}
		*/
		get protocol() {
			return this._protocol;
		}
		/**
		* @type {Number}
		*/
		get readyState() {
			return this._readyState;
		}
		/**
		* @type {String}
		*/
		get url() {
			return this._url;
		}
		/**
		* Set up the socket and the internal resources.
		*
		* @param {Duplex} socket The network socket between the server and client
		* @param {Buffer} head The first packet of the upgraded stream
		* @param {Object} options Options object
		* @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
		*     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
		*     multiple times in the same tick
		* @param {Function} [options.generateMask] The function used to generate the
		*     masking key
		* @param {Number} [options.maxPayload=0] The maximum allowed message size
		* @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
		*     not to skip UTF-8 validation for text and close messages
		* @private
		*/
		setSocket(socket, head, options) {
			const receiver = new Receiver({
				allowSynchronousEvents: options.allowSynchronousEvents,
				binaryType: this.binaryType,
				extensions: this._extensions,
				isServer: this._isServer,
				maxPayload: options.maxPayload,
				skipUTF8Validation: options.skipUTF8Validation
			});
			const sender = new Sender(socket, this._extensions, options.generateMask);
			this._receiver = receiver;
			this._sender = sender;
			this._socket = socket;
			receiver[kWebSocket] = this;
			sender[kWebSocket] = this;
			socket[kWebSocket] = this;
			receiver.on("conclude", receiverOnConclude);
			receiver.on("drain", receiverOnDrain);
			receiver.on("error", receiverOnError);
			receiver.on("message", receiverOnMessage);
			receiver.on("ping", receiverOnPing);
			receiver.on("pong", receiverOnPong);
			sender.onerror = senderOnError;
			if (socket.setTimeout) socket.setTimeout(0);
			if (socket.setNoDelay) socket.setNoDelay();
			if (head.length > 0) socket.unshift(head);
			socket.on("close", socketOnClose);
			socket.on("data", socketOnData);
			socket.on("end", socketOnEnd);
			socket.on("error", socketOnError);
			this._readyState = WebSocket.OPEN;
			this.emit("open");
		}
		/**
		* Emit the `'close'` event.
		*
		* @private
		*/
		emitClose() {
			if (!this._socket) {
				this._readyState = WebSocket.CLOSED;
				this.emit("close", this._closeCode, this._closeMessage);
				return;
			}
			if (this._extensions[PerMessageDeflate.extensionName]) this._extensions[PerMessageDeflate.extensionName].cleanup();
			this._receiver.removeAllListeners();
			this._readyState = WebSocket.CLOSED;
			this.emit("close", this._closeCode, this._closeMessage);
		}
		/**
		* Start a closing handshake.
		*
		*          +----------+   +-----------+   +----------+
		*     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
		*    |     +----------+   +-----------+   +----------+     |
		*          +----------+   +-----------+         |
		* CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
		*          +----------+   +-----------+   |
		*    |           |                        |   +---+        |
		*                +------------------------+-->|fin| - - - -
		*    |         +---+                      |   +---+
		*     - - - - -|fin|<---------------------+
		*              +---+
		*
		* @param {Number} [code] Status code explaining why the connection is closing
		* @param {(String|Buffer)} [data] The reason why the connection is
		*     closing
		* @public
		*/
		close(code, data) {
			if (this.readyState === WebSocket.CLOSED) return;
			if (this.readyState === WebSocket.CONNECTING) {
				abortHandshake(this, this._req, "WebSocket was closed before the connection was established");
				return;
			}
			if (this.readyState === WebSocket.CLOSING) {
				if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) this._socket.end();
				return;
			}
			this._readyState = WebSocket.CLOSING;
			this._sender.close(code, data, !this._isServer, (err) => {
				if (err) return;
				this._closeFrameSent = true;
				if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) this._socket.end();
			});
			setCloseTimer(this);
		}
		/**
		* Pause the socket.
		*
		* @public
		*/
		pause() {
			if (this.readyState === WebSocket.CONNECTING || this.readyState === WebSocket.CLOSED) return;
			this._paused = true;
			this._socket.pause();
		}
		/**
		* Send a ping.
		*
		* @param {*} [data] The data to send
		* @param {Boolean} [mask] Indicates whether or not to mask `data`
		* @param {Function} [cb] Callback which is executed when the ping is sent
		* @public
		*/
		ping(data, mask, cb) {
			if (this.readyState === WebSocket.CONNECTING) throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
			if (typeof data === "function") {
				cb = data;
				data = mask = void 0;
			} else if (typeof mask === "function") {
				cb = mask;
				mask = void 0;
			}
			if (typeof data === "number") data = data.toString();
			if (this.readyState !== WebSocket.OPEN) {
				sendAfterClose(this, data, cb);
				return;
			}
			if (mask === void 0) mask = !this._isServer;
			this._sender.ping(data || EMPTY_BUFFER, mask, cb);
		}
		/**
		* Send a pong.
		*
		* @param {*} [data] The data to send
		* @param {Boolean} [mask] Indicates whether or not to mask `data`
		* @param {Function} [cb] Callback which is executed when the pong is sent
		* @public
		*/
		pong(data, mask, cb) {
			if (this.readyState === WebSocket.CONNECTING) throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
			if (typeof data === "function") {
				cb = data;
				data = mask = void 0;
			} else if (typeof mask === "function") {
				cb = mask;
				mask = void 0;
			}
			if (typeof data === "number") data = data.toString();
			if (this.readyState !== WebSocket.OPEN) {
				sendAfterClose(this, data, cb);
				return;
			}
			if (mask === void 0) mask = !this._isServer;
			this._sender.pong(data || EMPTY_BUFFER, mask, cb);
		}
		/**
		* Resume the socket.
		*
		* @public
		*/
		resume() {
			if (this.readyState === WebSocket.CONNECTING || this.readyState === WebSocket.CLOSED) return;
			this._paused = false;
			if (!this._receiver._writableState.needDrain) this._socket.resume();
		}
		/**
		* Send a data message.
		*
		* @param {*} data The message to send
		* @param {Object} [options] Options object
		* @param {Boolean} [options.binary] Specifies whether `data` is binary or
		*     text
		* @param {Boolean} [options.compress] Specifies whether or not to compress
		*     `data`
		* @param {Boolean} [options.fin=true] Specifies whether the fragment is the
		*     last one
		* @param {Boolean} [options.mask] Specifies whether or not to mask `data`
		* @param {Function} [cb] Callback which is executed when data is written out
		* @public
		*/
		send(data, options, cb) {
			if (this.readyState === WebSocket.CONNECTING) throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
			if (typeof options === "function") {
				cb = options;
				options = {};
			}
			if (typeof data === "number") data = data.toString();
			if (this.readyState !== WebSocket.OPEN) {
				sendAfterClose(this, data, cb);
				return;
			}
			const opts = {
				binary: typeof data !== "string",
				mask: !this._isServer,
				compress: true,
				fin: true,
				...options
			};
			if (!this._extensions[PerMessageDeflate.extensionName]) opts.compress = false;
			this._sender.send(data || EMPTY_BUFFER, opts, cb);
		}
		/**
		* Forcibly close the connection.
		*
		* @public
		*/
		terminate() {
			if (this.readyState === WebSocket.CLOSED) return;
			if (this.readyState === WebSocket.CONNECTING) {
				abortHandshake(this, this._req, "WebSocket was closed before the connection was established");
				return;
			}
			if (this._socket) {
				this._readyState = WebSocket.CLOSING;
				this._socket.destroy();
			}
		}
	};
	/**
	* @constant {Number} CONNECTING
	* @memberof WebSocket
	*/
	Object.defineProperty(WebSocket, "CONNECTING", {
		enumerable: true,
		value: readyStates.indexOf("CONNECTING")
	});
	/**
	* @constant {Number} CONNECTING
	* @memberof WebSocket.prototype
	*/
	Object.defineProperty(WebSocket.prototype, "CONNECTING", {
		enumerable: true,
		value: readyStates.indexOf("CONNECTING")
	});
	/**
	* @constant {Number} OPEN
	* @memberof WebSocket
	*/
	Object.defineProperty(WebSocket, "OPEN", {
		enumerable: true,
		value: readyStates.indexOf("OPEN")
	});
	/**
	* @constant {Number} OPEN
	* @memberof WebSocket.prototype
	*/
	Object.defineProperty(WebSocket.prototype, "OPEN", {
		enumerable: true,
		value: readyStates.indexOf("OPEN")
	});
	/**
	* @constant {Number} CLOSING
	* @memberof WebSocket
	*/
	Object.defineProperty(WebSocket, "CLOSING", {
		enumerable: true,
		value: readyStates.indexOf("CLOSING")
	});
	/**
	* @constant {Number} CLOSING
	* @memberof WebSocket.prototype
	*/
	Object.defineProperty(WebSocket.prototype, "CLOSING", {
		enumerable: true,
		value: readyStates.indexOf("CLOSING")
	});
	/**
	* @constant {Number} CLOSED
	* @memberof WebSocket
	*/
	Object.defineProperty(WebSocket, "CLOSED", {
		enumerable: true,
		value: readyStates.indexOf("CLOSED")
	});
	/**
	* @constant {Number} CLOSED
	* @memberof WebSocket.prototype
	*/
	Object.defineProperty(WebSocket.prototype, "CLOSED", {
		enumerable: true,
		value: readyStates.indexOf("CLOSED")
	});
	[
		"binaryType",
		"bufferedAmount",
		"extensions",
		"isPaused",
		"protocol",
		"readyState",
		"url"
	].forEach((property) => {
		Object.defineProperty(WebSocket.prototype, property, { enumerable: true });
	});
	[
		"open",
		"error",
		"close",
		"message"
	].forEach((method) => {
		Object.defineProperty(WebSocket.prototype, `on${method}`, {
			enumerable: true,
			get() {
				for (const listener of this.listeners(method)) if (listener[kForOnEventAttribute]) return listener[kListener];
				return null;
			},
			set(handler) {
				for (const listener of this.listeners(method)) if (listener[kForOnEventAttribute]) {
					this.removeListener(method, listener);
					break;
				}
				if (typeof handler !== "function") return;
				this.addEventListener(method, handler, { [kForOnEventAttribute]: true });
			}
		});
	});
	WebSocket.prototype.addEventListener = addEventListener;
	WebSocket.prototype.removeEventListener = removeEventListener;
	module.exports = WebSocket;
	/**
	* Initialize a WebSocket client.
	*
	* @param {WebSocket} websocket The client to initialize
	* @param {(String|URL)} address The URL to which to connect
	* @param {Array} protocols The subprotocols
	* @param {Object} [options] Connection options
	* @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether any
	*     of the `'message'`, `'ping'`, and `'pong'` events can be emitted multiple
	*     times in the same tick
	* @param {Boolean} [options.autoPong=true] Specifies whether or not to
	*     automatically send a pong in response to a ping
	* @param {Function} [options.finishRequest] A function which can be used to
	*     customize the headers of each http request before it is sent
	* @param {Boolean} [options.followRedirects=false] Whether or not to follow
	*     redirects
	* @param {Function} [options.generateMask] The function used to generate the
	*     masking key
	* @param {Number} [options.handshakeTimeout] Timeout in milliseconds for the
	*     handshake request
	* @param {Number} [options.maxPayload=104857600] The maximum allowed message
	*     size
	* @param {Number} [options.maxRedirects=10] The maximum number of redirects
	*     allowed
	* @param {String} [options.origin] Value of the `Origin` or
	*     `Sec-WebSocket-Origin` header
	* @param {(Boolean|Object)} [options.perMessageDeflate=true] Enable/disable
	*     permessage-deflate
	* @param {Number} [options.protocolVersion=13] Value of the
	*     `Sec-WebSocket-Version` header
	* @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
	*     not to skip UTF-8 validation for text and close messages
	* @private
	*/
	function initAsClient(websocket, address, protocols, options) {
		const opts = {
			allowSynchronousEvents: true,
			autoPong: true,
			protocolVersion: protocolVersions[1],
			maxPayload: 104857600,
			skipUTF8Validation: false,
			perMessageDeflate: true,
			followRedirects: false,
			maxRedirects: 10,
			...options,
			socketPath: void 0,
			hostname: void 0,
			protocol: void 0,
			timeout: void 0,
			method: "GET",
			host: void 0,
			path: void 0,
			port: void 0
		};
		websocket._autoPong = opts.autoPong;
		if (!protocolVersions.includes(opts.protocolVersion)) throw new RangeError(`Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`);
		let parsedUrl;
		if (address instanceof URL) parsedUrl = address;
		else try {
			parsedUrl = new URL(address);
		} catch (e) {
			throw new SyntaxError(`Invalid URL: ${address}`);
		}
		if (parsedUrl.protocol === "http:") parsedUrl.protocol = "ws:";
		else if (parsedUrl.protocol === "https:") parsedUrl.protocol = "wss:";
		websocket._url = parsedUrl.href;
		const isSecure = parsedUrl.protocol === "wss:";
		const isIpcUrl = parsedUrl.protocol === "ws+unix:";
		let invalidUrlMessage;
		if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) invalidUrlMessage = "The URL's protocol must be one of \"ws:\", \"wss:\", \"http:\", \"https:\", or \"ws+unix:\"";
		else if (isIpcUrl && !parsedUrl.pathname) invalidUrlMessage = "The URL's pathname is empty";
		else if (parsedUrl.hash) invalidUrlMessage = "The URL contains a fragment identifier";
		if (invalidUrlMessage) {
			const err = new SyntaxError(invalidUrlMessage);
			if (websocket._redirects === 0) throw err;
			else {
				emitErrorAndClose(websocket, err);
				return;
			}
		}
		const defaultPort = isSecure ? 443 : 80;
		const key = randomBytes(16).toString("base64");
		const request = isSecure ? https.request : http.request;
		const protocolSet = /* @__PURE__ */ new Set();
		let perMessageDeflate;
		opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
		opts.defaultPort = opts.defaultPort || defaultPort;
		opts.port = parsedUrl.port || defaultPort;
		opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
		opts.headers = {
			...opts.headers,
			"Sec-WebSocket-Version": opts.protocolVersion,
			"Sec-WebSocket-Key": key,
			Connection: "Upgrade",
			Upgrade: "websocket"
		};
		opts.path = parsedUrl.pathname + parsedUrl.search;
		opts.timeout = opts.handshakeTimeout;
		if (opts.perMessageDeflate) {
			perMessageDeflate = new PerMessageDeflate(opts.perMessageDeflate !== true ? opts.perMessageDeflate : {}, false, opts.maxPayload);
			opts.headers["Sec-WebSocket-Extensions"] = format({ [PerMessageDeflate.extensionName]: perMessageDeflate.offer() });
		}
		if (protocols.length) {
			for (const protocol of protocols) {
				if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) throw new SyntaxError("An invalid or duplicated subprotocol was specified");
				protocolSet.add(protocol);
			}
			opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
		}
		if (opts.origin) {
			if (opts.protocolVersion < 13) opts.headers["Sec-WebSocket-Origin"] = opts.origin;
			else opts.headers.Origin = opts.origin;
		}
		if (parsedUrl.username || parsedUrl.password) opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
		if (isIpcUrl) {
			const parts = opts.path.split(":");
			opts.socketPath = parts[0];
			opts.path = parts[1];
		}
		let req;
		if (opts.followRedirects) {
			if (websocket._redirects === 0) {
				websocket._originalIpc = isIpcUrl;
				websocket._originalSecure = isSecure;
				websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
				const headers = options && options.headers;
				options = {
					...options,
					headers: {}
				};
				if (headers) for (const [key, value] of Object.entries(headers)) options.headers[key.toLowerCase()] = value;
			} else if (websocket.listenerCount("redirect") === 0) {
				const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
				if (!isSameHost || websocket._originalSecure && !isSecure) {
					delete opts.headers.authorization;
					delete opts.headers.cookie;
					if (!isSameHost) delete opts.headers.host;
					opts.auth = void 0;
				}
			}
			if (opts.auth && !options.headers.authorization) options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
			req = websocket._req = request(opts);
			if (websocket._redirects) websocket.emit("redirect", websocket.url, req);
		} else req = websocket._req = request(opts);
		if (opts.timeout) req.on("timeout", () => {
			abortHandshake(websocket, req, "Opening handshake has timed out");
		});
		req.on("error", (err) => {
			if (req === null || req[kAborted]) return;
			req = websocket._req = null;
			emitErrorAndClose(websocket, err);
		});
		req.on("response", (res) => {
			const location = res.headers.location;
			const statusCode = res.statusCode;
			if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
				if (++websocket._redirects > opts.maxRedirects) {
					abortHandshake(websocket, req, "Maximum redirects exceeded");
					return;
				}
				req.abort();
				let addr;
				try {
					addr = new URL(location, address);
				} catch (e) {
					emitErrorAndClose(websocket, /* @__PURE__ */ new SyntaxError(`Invalid URL: ${location}`));
					return;
				}
				initAsClient(websocket, addr, protocols, options);
			} else if (!websocket.emit("unexpected-response", req, res)) abortHandshake(websocket, req, `Unexpected server response: ${res.statusCode}`);
		});
		req.on("upgrade", (res, socket, head) => {
			websocket.emit("upgrade", res);
			if (websocket.readyState !== WebSocket.CONNECTING) return;
			req = websocket._req = null;
			const upgrade = res.headers.upgrade;
			if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
				abortHandshake(websocket, socket, "Invalid Upgrade header");
				return;
			}
			const digest = createHash("sha1").update(key + GUID).digest("base64");
			if (res.headers["sec-websocket-accept"] !== digest) {
				abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
				return;
			}
			const serverProt = res.headers["sec-websocket-protocol"];
			let protError;
			if (serverProt !== void 0) {
				if (!protocolSet.size) protError = "Server sent a subprotocol but none was requested";
				else if (!protocolSet.has(serverProt)) protError = "Server sent an invalid subprotocol";
			} else if (protocolSet.size) protError = "Server sent no subprotocol";
			if (protError) {
				abortHandshake(websocket, socket, protError);
				return;
			}
			if (serverProt) websocket._protocol = serverProt;
			const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
			if (secWebSocketExtensions !== void 0) {
				if (!perMessageDeflate) {
					abortHandshake(websocket, socket, "Server sent a Sec-WebSocket-Extensions header but no extension was requested");
					return;
				}
				let extensions;
				try {
					extensions = parse(secWebSocketExtensions);
				} catch (err) {
					abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Extensions header");
					return;
				}
				const extensionNames = Object.keys(extensions);
				if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate.extensionName) {
					abortHandshake(websocket, socket, "Server indicated an extension that was not requested");
					return;
				}
				try {
					perMessageDeflate.accept(extensions[PerMessageDeflate.extensionName]);
				} catch (err) {
					abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Extensions header");
					return;
				}
				websocket._extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
			}
			websocket.setSocket(socket, head, {
				allowSynchronousEvents: opts.allowSynchronousEvents,
				generateMask: opts.generateMask,
				maxPayload: opts.maxPayload,
				skipUTF8Validation: opts.skipUTF8Validation
			});
		});
		if (opts.finishRequest) opts.finishRequest(req, websocket);
		else req.end();
	}
	/**
	* Emit the `'error'` and `'close'` events.
	*
	* @param {WebSocket} websocket The WebSocket instance
	* @param {Error} The error to emit
	* @private
	*/
	function emitErrorAndClose(websocket, err) {
		websocket._readyState = WebSocket.CLOSING;
		websocket._errorEmitted = true;
		websocket.emit("error", err);
		websocket.emitClose();
	}
	/**
	* Create a `net.Socket` and initiate a connection.
	*
	* @param {Object} options Connection options
	* @return {net.Socket} The newly created socket used to start the connection
	* @private
	*/
	function netConnect(options) {
		options.path = options.socketPath;
		return net.connect(options);
	}
	/**
	* Create a `tls.TLSSocket` and initiate a connection.
	*
	* @param {Object} options Connection options
	* @return {tls.TLSSocket} The newly created socket used to start the connection
	* @private
	*/
	function tlsConnect(options) {
		options.path = void 0;
		if (!options.servername && options.servername !== "") options.servername = net.isIP(options.host) ? "" : options.host;
		return tls.connect(options);
	}
	/**
	* Abort the handshake and emit an error.
	*
	* @param {WebSocket} websocket The WebSocket instance
	* @param {(http.ClientRequest|net.Socket|tls.Socket)} stream The request to
	*     abort or the socket to destroy
	* @param {String} message The error message
	* @private
	*/
	function abortHandshake(websocket, stream, message) {
		websocket._readyState = WebSocket.CLOSING;
		const err = new Error(message);
		Error.captureStackTrace(err, abortHandshake);
		if (stream.setHeader) {
			stream[kAborted] = true;
			stream.abort();
			if (stream.socket && !stream.socket.destroyed) stream.socket.destroy();
			process.nextTick(emitErrorAndClose, websocket, err);
		} else {
			stream.destroy(err);
			stream.once("error", websocket.emit.bind(websocket, "error"));
			stream.once("close", websocket.emitClose.bind(websocket));
		}
	}
	/**
	* Handle cases where the `ping()`, `pong()`, or `send()` methods are called
	* when the `readyState` attribute is `CLOSING` or `CLOSED`.
	*
	* @param {WebSocket} websocket The WebSocket instance
	* @param {*} [data] The data to send
	* @param {Function} [cb] Callback
	* @private
	*/
	function sendAfterClose(websocket, data, cb) {
		if (data) {
			const length = isBlob(data) ? data.size : toBuffer(data).length;
			if (websocket._socket) websocket._sender._bufferedBytes += length;
			else websocket._bufferedAmount += length;
		}
		if (cb) {
			const err = /* @__PURE__ */ new Error(`WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`);
			process.nextTick(cb, err);
		}
	}
	/**
	* The listener of the `Receiver` `'conclude'` event.
	*
	* @param {Number} code The status code
	* @param {Buffer} reason The reason for closing
	* @private
	*/
	function receiverOnConclude(code, reason) {
		const websocket = this[kWebSocket];
		websocket._closeFrameReceived = true;
		websocket._closeMessage = reason;
		websocket._closeCode = code;
		if (websocket._socket[kWebSocket] === void 0) return;
		websocket._socket.removeListener("data", socketOnData);
		process.nextTick(resume, websocket._socket);
		if (code === 1005) websocket.close();
		else websocket.close(code, reason);
	}
	/**
	* The listener of the `Receiver` `'drain'` event.
	*
	* @private
	*/
	function receiverOnDrain() {
		const websocket = this[kWebSocket];
		if (!websocket.isPaused) websocket._socket.resume();
	}
	/**
	* The listener of the `Receiver` `'error'` event.
	*
	* @param {(RangeError|Error)} err The emitted error
	* @private
	*/
	function receiverOnError(err) {
		const websocket = this[kWebSocket];
		if (websocket._socket[kWebSocket] !== void 0) {
			websocket._socket.removeListener("data", socketOnData);
			process.nextTick(resume, websocket._socket);
			websocket.close(err[kStatusCode]);
		}
		if (!websocket._errorEmitted) {
			websocket._errorEmitted = true;
			websocket.emit("error", err);
		}
	}
	/**
	* The listener of the `Receiver` `'finish'` event.
	*
	* @private
	*/
	function receiverOnFinish() {
		this[kWebSocket].emitClose();
	}
	/**
	* The listener of the `Receiver` `'message'` event.
	*
	* @param {Buffer|ArrayBuffer|Buffer[])} data The message
	* @param {Boolean} isBinary Specifies whether the message is binary or not
	* @private
	*/
	function receiverOnMessage(data, isBinary) {
		this[kWebSocket].emit("message", data, isBinary);
	}
	/**
	* The listener of the `Receiver` `'ping'` event.
	*
	* @param {Buffer} data The data included in the ping frame
	* @private
	*/
	function receiverOnPing(data) {
		const websocket = this[kWebSocket];
		if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
		websocket.emit("ping", data);
	}
	/**
	* The listener of the `Receiver` `'pong'` event.
	*
	* @param {Buffer} data The data included in the pong frame
	* @private
	*/
	function receiverOnPong(data) {
		this[kWebSocket].emit("pong", data);
	}
	/**
	* Resume a readable stream
	*
	* @param {Readable} stream The readable stream
	* @private
	*/
	function resume(stream) {
		stream.resume();
	}
	/**
	* The `Sender` error event handler.
	*
	* @param {Error} The error
	* @private
	*/
	function senderOnError(err) {
		const websocket = this[kWebSocket];
		if (websocket.readyState === WebSocket.CLOSED) return;
		if (websocket.readyState === WebSocket.OPEN) {
			websocket._readyState = WebSocket.CLOSING;
			setCloseTimer(websocket);
		}
		this._socket.end();
		if (!websocket._errorEmitted) {
			websocket._errorEmitted = true;
			websocket.emit("error", err);
		}
	}
	/**
	* Set a timer to destroy the underlying raw socket of a WebSocket.
	*
	* @param {WebSocket} websocket The WebSocket instance
	* @private
	*/
	function setCloseTimer(websocket) {
		websocket._closeTimer = setTimeout(websocket._socket.destroy.bind(websocket._socket), closeTimeout);
	}
	/**
	* The listener of the socket `'close'` event.
	*
	* @private
	*/
	function socketOnClose() {
		const websocket = this[kWebSocket];
		this.removeListener("close", socketOnClose);
		this.removeListener("data", socketOnData);
		this.removeListener("end", socketOnEnd);
		websocket._readyState = WebSocket.CLOSING;
		let chunk;
		if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && (chunk = websocket._socket.read()) !== null) websocket._receiver.write(chunk);
		websocket._receiver.end();
		this[kWebSocket] = void 0;
		clearTimeout(websocket._closeTimer);
		if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) websocket.emitClose();
		else {
			websocket._receiver.on("error", receiverOnFinish);
			websocket._receiver.on("finish", receiverOnFinish);
		}
	}
	/**
	* The listener of the socket `'data'` event.
	*
	* @param {Buffer} chunk A chunk of data
	* @private
	*/
	function socketOnData(chunk) {
		if (!this[kWebSocket]._receiver.write(chunk)) this.pause();
	}
	/**
	* The listener of the socket `'end'` event.
	*
	* @private
	*/
	function socketOnEnd() {
		const websocket = this[kWebSocket];
		websocket._readyState = WebSocket.CLOSING;
		websocket._receiver.end();
		this.end();
	}
	/**
	* The listener of the socket `'error'` event.
	*
	* @private
	*/
	function socketOnError() {
		const websocket = this[kWebSocket];
		this.removeListener("error", socketOnError);
		this.on("error", NOOP);
		if (websocket) {
			websocket._readyState = WebSocket.CLOSING;
			this.destroy();
		}
	}
}));
//#endregion
//#region node_modules/ws/lib/stream.js
var require_stream = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	require_websocket();
	const { Duplex } = __require("stream");
	/**
	* Emits the `'close'` event on a stream.
	*
	* @param {Duplex} stream The stream.
	* @private
	*/
	function emitClose(stream) {
		stream.emit("close");
	}
	/**
	* The listener of the `'end'` event.
	*
	* @private
	*/
	function duplexOnEnd() {
		if (!this.destroyed && this._writableState.finished) this.destroy();
	}
	/**
	* The listener of the `'error'` event.
	*
	* @param {Error} err The error
	* @private
	*/
	function duplexOnError(err) {
		this.removeListener("error", duplexOnError);
		this.destroy();
		if (this.listenerCount("error") === 0) this.emit("error", err);
	}
	/**
	* Wraps a `WebSocket` in a duplex stream.
	*
	* @param {WebSocket} ws The `WebSocket` to wrap
	* @param {Object} [options] The options for the `Duplex` constructor
	* @return {Duplex} The duplex stream
	* @public
	*/
	function createWebSocketStream(ws, options) {
		let terminateOnDestroy = true;
		const duplex = new Duplex({
			...options,
			autoDestroy: false,
			emitClose: false,
			objectMode: false,
			writableObjectMode: false
		});
		ws.on("message", function message(msg, isBinary) {
			const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
			if (!duplex.push(data)) ws.pause();
		});
		ws.once("error", function error(err) {
			if (duplex.destroyed) return;
			terminateOnDestroy = false;
			duplex.destroy(err);
		});
		ws.once("close", function close() {
			if (duplex.destroyed) return;
			duplex.push(null);
		});
		duplex._destroy = function(err, callback) {
			if (ws.readyState === ws.CLOSED) {
				callback(err);
				process.nextTick(emitClose, duplex);
				return;
			}
			let called = false;
			ws.once("error", function error(err) {
				called = true;
				callback(err);
			});
			ws.once("close", function close() {
				if (!called) callback(err);
				process.nextTick(emitClose, duplex);
			});
			if (terminateOnDestroy) ws.terminate();
		};
		duplex._final = function(callback) {
			if (ws.readyState === ws.CONNECTING) {
				ws.once("open", function open() {
					duplex._final(callback);
				});
				return;
			}
			if (ws._socket === null) return;
			if (ws._socket._writableState.finished) {
				callback();
				if (duplex._readableState.endEmitted) duplex.destroy();
			} else {
				ws._socket.once("finish", function finish() {
					callback();
				});
				ws.close();
			}
		};
		duplex._read = function() {
			if (ws.isPaused) ws.resume();
		};
		duplex._write = function(chunk, encoding, callback) {
			if (ws.readyState === ws.CONNECTING) {
				ws.once("open", function open() {
					duplex._write(chunk, encoding, callback);
				});
				return;
			}
			ws.send(chunk, callback);
		};
		duplex.on("end", duplexOnEnd);
		duplex.on("error", duplexOnError);
		return duplex;
	}
	module.exports = createWebSocketStream;
}));
//#endregion
//#region node_modules/ws/lib/subprotocol.js
var require_subprotocol = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const { tokenChars } = require_validation();
	/**
	* Parses the `Sec-WebSocket-Protocol` header into a set of subprotocol names.
	*
	* @param {String} header The field value of the header
	* @return {Set} The subprotocol names
	* @public
	*/
	function parse(header) {
		const protocols = /* @__PURE__ */ new Set();
		let start = -1;
		let end = -1;
		let i = 0;
		for (; i < header.length; i++) {
			const code = header.charCodeAt(i);
			if (end === -1 && tokenChars[code] === 1) {
				if (start === -1) start = i;
			} else if (i !== 0 && (code === 32 || code === 9)) {
				if (end === -1 && start !== -1) end = i;
			} else if (code === 44) {
				if (start === -1) throw new SyntaxError(`Unexpected character at index ${i}`);
				if (end === -1) end = i;
				const protocol = header.slice(start, end);
				if (protocols.has(protocol)) throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
				protocols.add(protocol);
				start = end = -1;
			} else throw new SyntaxError(`Unexpected character at index ${i}`);
		}
		if (start === -1 || end !== -1) throw new SyntaxError("Unexpected end of input");
		const protocol = header.slice(start, i);
		if (protocols.has(protocol)) throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
		protocols.add(protocol);
		return protocols;
	}
	module.exports = { parse };
}));
//#endregion
//#region node_modules/ws/lib/websocket-server.js
var require_websocket_server = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const EventEmitter = __require("events");
	const http = __require("http");
	const { Duplex } = __require("stream");
	const { createHash } = __require("crypto");
	const extension = require_extension();
	const PerMessageDeflate = require_permessage_deflate();
	const subprotocol = require_subprotocol();
	const WebSocket = require_websocket();
	const { GUID, kWebSocket } = require_constants();
	const keyRegex = /^[+/0-9A-Za-z]{22}==$/;
	const RUNNING = 0;
	const CLOSING = 1;
	const CLOSED = 2;
	/**
	* Class representing a WebSocket server.
	*
	* @extends EventEmitter
	*/
	var WebSocketServer = class extends EventEmitter {
		/**
		* Create a `WebSocketServer` instance.
		*
		* @param {Object} options Configuration options
		* @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
		*     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
		*     multiple times in the same tick
		* @param {Boolean} [options.autoPong=true] Specifies whether or not to
		*     automatically send a pong in response to a ping
		* @param {Number} [options.backlog=511] The maximum length of the queue of
		*     pending connections
		* @param {Boolean} [options.clientTracking=true] Specifies whether or not to
		*     track clients
		* @param {Function} [options.handleProtocols] A hook to handle protocols
		* @param {String} [options.host] The hostname where to bind the server
		* @param {Number} [options.maxPayload=104857600] The maximum allowed message
		*     size
		* @param {Boolean} [options.noServer=false] Enable no server mode
		* @param {String} [options.path] Accept only connections matching this path
		* @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
		*     permessage-deflate
		* @param {Number} [options.port] The port where to bind the server
		* @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
		*     server to use
		* @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
		*     not to skip UTF-8 validation for text and close messages
		* @param {Function} [options.verifyClient] A hook to reject connections
		* @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
		*     class to use. It must be the `WebSocket` class or class that extends it
		* @param {Function} [callback] A listener for the `listening` event
		*/
		constructor(options, callback) {
			super();
			options = {
				allowSynchronousEvents: true,
				autoPong: true,
				maxPayload: 104857600,
				skipUTF8Validation: false,
				perMessageDeflate: false,
				handleProtocols: null,
				clientTracking: true,
				verifyClient: null,
				noServer: false,
				backlog: null,
				server: null,
				host: null,
				path: null,
				port: null,
				WebSocket,
				...options
			};
			if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) throw new TypeError("One and only one of the \"port\", \"server\", or \"noServer\" options must be specified");
			if (options.port != null) {
				this._server = http.createServer((req, res) => {
					const body = http.STATUS_CODES[426];
					res.writeHead(426, {
						"Content-Length": body.length,
						"Content-Type": "text/plain"
					});
					res.end(body);
				});
				this._server.listen(options.port, options.host, options.backlog, callback);
			} else if (options.server) this._server = options.server;
			if (this._server) {
				const emitConnection = this.emit.bind(this, "connection");
				this._removeListeners = addListeners(this._server, {
					listening: this.emit.bind(this, "listening"),
					error: this.emit.bind(this, "error"),
					upgrade: (req, socket, head) => {
						this.handleUpgrade(req, socket, head, emitConnection);
					}
				});
			}
			if (options.perMessageDeflate === true) options.perMessageDeflate = {};
			if (options.clientTracking) {
				this.clients = /* @__PURE__ */ new Set();
				this._shouldEmitClose = false;
			}
			this.options = options;
			this._state = RUNNING;
		}
		/**
		* Returns the bound address, the address family name, and port of the server
		* as reported by the operating system if listening on an IP socket.
		* If the server is listening on a pipe or UNIX domain socket, the name is
		* returned as a string.
		*
		* @return {(Object|String|null)} The address of the server
		* @public
		*/
		address() {
			if (this.options.noServer) throw new Error("The server is operating in \"noServer\" mode");
			if (!this._server) return null;
			return this._server.address();
		}
		/**
		* Stop the server from accepting new connections and emit the `'close'` event
		* when all existing connections are closed.
		*
		* @param {Function} [cb] A one-time listener for the `'close'` event
		* @public
		*/
		close(cb) {
			if (this._state === CLOSED) {
				if (cb) this.once("close", () => {
					cb(/* @__PURE__ */ new Error("The server is not running"));
				});
				process.nextTick(emitClose, this);
				return;
			}
			if (cb) this.once("close", cb);
			if (this._state === CLOSING) return;
			this._state = CLOSING;
			if (this.options.noServer || this.options.server) {
				if (this._server) {
					this._removeListeners();
					this._removeListeners = this._server = null;
				}
				if (this.clients) {
					if (!this.clients.size) process.nextTick(emitClose, this);
					else this._shouldEmitClose = true;
				} else process.nextTick(emitClose, this);
			} else {
				const server = this._server;
				this._removeListeners();
				this._removeListeners = this._server = null;
				server.close(() => {
					emitClose(this);
				});
			}
		}
		/**
		* See if a given request should be handled by this server instance.
		*
		* @param {http.IncomingMessage} req Request object to inspect
		* @return {Boolean} `true` if the request is valid, else `false`
		* @public
		*/
		shouldHandle(req) {
			if (this.options.path) {
				const index = req.url.indexOf("?");
				if ((index !== -1 ? req.url.slice(0, index) : req.url) !== this.options.path) return false;
			}
			return true;
		}
		/**
		* Handle a HTTP Upgrade request.
		*
		* @param {http.IncomingMessage} req The request object
		* @param {Duplex} socket The network socket between the server and client
		* @param {Buffer} head The first packet of the upgraded stream
		* @param {Function} cb Callback
		* @public
		*/
		handleUpgrade(req, socket, head, cb) {
			socket.on("error", socketOnError);
			const key = req.headers["sec-websocket-key"];
			const upgrade = req.headers.upgrade;
			const version = +req.headers["sec-websocket-version"];
			if (req.method !== "GET") {
				abortHandshakeOrEmitwsClientError(this, req, socket, 405, "Invalid HTTP method");
				return;
			}
			if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
				abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Invalid Upgrade header");
				return;
			}
			if (key === void 0 || !keyRegex.test(key)) {
				abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Missing or invalid Sec-WebSocket-Key header");
				return;
			}
			if (version !== 13 && version !== 8) {
				abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Missing or invalid Sec-WebSocket-Version header", { "Sec-WebSocket-Version": "13, 8" });
				return;
			}
			if (!this.shouldHandle(req)) {
				abortHandshake(socket, 400);
				return;
			}
			const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
			let protocols = /* @__PURE__ */ new Set();
			if (secWebSocketProtocol !== void 0) try {
				protocols = subprotocol.parse(secWebSocketProtocol);
			} catch (err) {
				abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Invalid Sec-WebSocket-Protocol header");
				return;
			}
			const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
			const extensions = {};
			if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
				const perMessageDeflate = new PerMessageDeflate(this.options.perMessageDeflate, true, this.options.maxPayload);
				try {
					const offers = extension.parse(secWebSocketExtensions);
					if (offers[PerMessageDeflate.extensionName]) {
						perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
						extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
					}
				} catch (err) {
					abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Invalid or unacceptable Sec-WebSocket-Extensions header");
					return;
				}
			}
			if (this.options.verifyClient) {
				const info = {
					origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
					secure: !!(req.socket.authorized || req.socket.encrypted),
					req
				};
				if (this.options.verifyClient.length === 2) {
					this.options.verifyClient(info, (verified, code, message, headers) => {
						if (!verified) return abortHandshake(socket, code || 401, message, headers);
						this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
					});
					return;
				}
				if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
			}
			this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
		}
		/**
		* Upgrade the connection to WebSocket.
		*
		* @param {Object} extensions The accepted extensions
		* @param {String} key The value of the `Sec-WebSocket-Key` header
		* @param {Set} protocols The subprotocols
		* @param {http.IncomingMessage} req The request object
		* @param {Duplex} socket The network socket between the server and client
		* @param {Buffer} head The first packet of the upgraded stream
		* @param {Function} cb Callback
		* @throws {Error} If called more than once with the same socket
		* @private
		*/
		completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
			if (!socket.readable || !socket.writable) return socket.destroy();
			if (socket[kWebSocket]) throw new Error("server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration");
			if (this._state > RUNNING) return abortHandshake(socket, 503);
			const headers = [
				"HTTP/1.1 101 Switching Protocols",
				"Upgrade: websocket",
				"Connection: Upgrade",
				`Sec-WebSocket-Accept: ${createHash("sha1").update(key + GUID).digest("base64")}`
			];
			const ws = new this.options.WebSocket(null, void 0, this.options);
			if (protocols.size) {
				const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
				if (protocol) {
					headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
					ws._protocol = protocol;
				}
			}
			if (extensions[PerMessageDeflate.extensionName]) {
				const params = extensions[PerMessageDeflate.extensionName].params;
				const value = extension.format({ [PerMessageDeflate.extensionName]: [params] });
				headers.push(`Sec-WebSocket-Extensions: ${value}`);
				ws._extensions = extensions;
			}
			this.emit("headers", headers, req);
			socket.write(headers.concat("\r\n").join("\r\n"));
			socket.removeListener("error", socketOnError);
			ws.setSocket(socket, head, {
				allowSynchronousEvents: this.options.allowSynchronousEvents,
				maxPayload: this.options.maxPayload,
				skipUTF8Validation: this.options.skipUTF8Validation
			});
			if (this.clients) {
				this.clients.add(ws);
				ws.on("close", () => {
					this.clients.delete(ws);
					if (this._shouldEmitClose && !this.clients.size) process.nextTick(emitClose, this);
				});
			}
			cb(ws, req);
		}
	};
	module.exports = WebSocketServer;
	/**
	* Add event listeners on an `EventEmitter` using a map of <event, listener>
	* pairs.
	*
	* @param {EventEmitter} server The event emitter
	* @param {Object.<String, Function>} map The listeners to add
	* @return {Function} A function that will remove the added listeners when
	*     called
	* @private
	*/
	function addListeners(server, map) {
		for (const event of Object.keys(map)) server.on(event, map[event]);
		return function removeListeners() {
			for (const event of Object.keys(map)) server.removeListener(event, map[event]);
		};
	}
	/**
	* Emit a `'close'` event on an `EventEmitter`.
	*
	* @param {EventEmitter} server The event emitter
	* @private
	*/
	function emitClose(server) {
		server._state = CLOSED;
		server.emit("close");
	}
	/**
	* Handle socket errors.
	*
	* @private
	*/
	function socketOnError() {
		this.destroy();
	}
	/**
	* Close the connection when preconditions are not fulfilled.
	*
	* @param {Duplex} socket The socket of the upgrade request
	* @param {Number} code The HTTP response status code
	* @param {String} [message] The HTTP response body
	* @param {Object} [headers] Additional HTTP response headers
	* @private
	*/
	function abortHandshake(socket, code, message, headers) {
		message = message || http.STATUS_CODES[code];
		headers = {
			Connection: "close",
			"Content-Type": "text/html",
			"Content-Length": Buffer.byteLength(message),
			...headers
		};
		socket.once("finish", socket.destroy);
		socket.end(`HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r\n` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message);
	}
	/**
	* Emit a `'wsClientError'` event on a `WebSocketServer` if there is at least
	* one listener for it, otherwise call `abortHandshake()`.
	*
	* @param {WebSocketServer} server The WebSocket server
	* @param {http.IncomingMessage} req The request object
	* @param {Duplex} socket The socket of the upgrade request
	* @param {Number} code The HTTP response status code
	* @param {String} message The HTTP response body
	* @param {Object} [headers] The HTTP response headers
	* @private
	*/
	function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
		if (server.listenerCount("wsClientError")) {
			const err = new Error(message);
			Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
			server.emit("wsClientError", err, socket, req);
		} else abortHandshake(socket, code, message, headers);
	}
}));
require_stream();
require_receiver();
require_sender();
require_websocket();
var import_websocket_server = /* @__PURE__ */ __toESM(require_websocket_server(), 1);
//#endregion
//#region src/shared/online/hubProtocol.ts
/** 서버 심판이 보낸 메시지의 보낸 사람 */
const REFEREE_FROM = "server";
//#endregion
//#region src/server/hub.ts
const LIMIT = {
	/** 메시지 한 개 최대 글자 수 */
	text: 16e3,
	/** 1초에 보낼 수 있는 메시지 (배구 방장이 상태를 1초에 60번 + 키·핑, 넉넉히) */
	perSecond: 150,
	rooms: 4,
	watches: 20,
	adverts: 4,
	advertText: 1e3,
	capacity: 16,
	/** 한 계정(익명 로그인)이 동시에 열 수 있는 접속 (탭 여러 개 정도만) */
	connPerUser: 6,
	/** 틀린 방 코드를 이만큼 넣으면 잠깐 막음 (비공개 코드 숫자 4자리를 다 넣어 보는 것 막기) */
	badJoins: 8,
	badJoinWindowMs: 3e5
};
/** 이만큼 메시지가 없으면 '지금 하는 중'으로 안 침 (서버 업데이트를 미룰지 볼 때) */
const ACTIVE_MS = 9e5;
/** 이만큼 아무 일 없는 방은 서버가 닫음 (탭만 켜 두고 자리를 뜬 방이 영영 남지 않게) */
const IDLE_CLOSE_MS = 108e5;
const ID_RE = /^[A-Z0-9]{4,12}$/;
const PIN_RE = /^\d{4}$/;
const GAME_RE = /^[a-z0-9-]{2,24}$/;
const LIST_RE = /^[a-z0-9-]{2,40}$/;
const clean$1 = (v, max) => typeof v === "string" ? [...v.replace(/[\u0000-\u001f\u007f]/g, "")].slice(0, max).join("") : "";
const randomKey = (prefix) => `${prefix}-${Array.from(crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(6)), (b) => b.toString(36).padStart(2, "0")).join("")}`;
var Session = class {
	uid = null;
	/** 이 접속이 들어가 있는 방 topic → 내 접속 번호 */
	rooms = /* @__PURE__ */ new Map();
	watches = /* @__PURE__ */ new Set();
	/** 목록 이름 → 올린 방 topic */
	adverts = /* @__PURE__ */ new Map();
	tokens = LIMIT.perSecond;
	lastRefill = 0;
	conn;
	constructor(conn) {
		this.conn = conn;
	}
	push(msg) {
		try {
			this.conn.send(JSON.stringify(msg));
		} catch {}
	}
};
var Hub = class {
	rooms = /* @__PURE__ */ new Map();
	/** 목록 이름 → (방 topic → 올린 정보) */
	lists = /* @__PURE__ */ new Map();
	watchers = /* @__PURE__ */ new Map();
	opts;
	now;
	/** 계정별: 열린 접속 수, 틀린 방 코드 기록 */
	conns = /* @__PURE__ */ new Map();
	badJoins = /* @__PURE__ */ new Map();
	constructor(opts) {
		this.opts = opts;
		this.now = opts.now ?? Date.now;
	}
	/** 오래 아무 일 없는 방 닫기 (game-server/main.ts가 10분마다 부름) */
	sweep() {
		const now = this.now();
		for (const room of [...this.rooms.values()]) if (now - room.lastActive > IDLE_CLOSE_MS) this.dropRoom(room);
		for (const [uid, ts] of this.badJoins) if (ts.every((t) => now - t > LIMIT.badJoinWindowMs)) this.badJoins.delete(uid);
	}
	/** 새 접속. 받은 글자는 receive, 끊기면 close */
	open(conn) {
		const s = new Session(conn);
		s.lastRefill = this.now();
		return {
			receive: (text) => void this.receive(s, text),
			close: () => this.closeSession(s)
		};
	}
	/** 지금 방 수 (테스트·상태 보기) */
	stats() {
		const now = this.now();
		const active = [...this.rooms.values()].filter((r) => now - r.lastActive < ACTIVE_MS && [...r.members.values()].some((m) => m.session)).length;
		return {
			rooms: this.rooms.size,
			active,
			lists: this.lists.size
		};
	}
	allow(s) {
		const now = this.now();
		s.tokens = Math.min(LIMIT.perSecond, s.tokens + (now - s.lastRefill) / 1e3 * LIMIT.perSecond);
		s.lastRefill = now;
		if (s.tokens < 1) return false;
		s.tokens -= 1;
		return true;
	}
	async receive(s, text) {
		if (text.length > LIMIT.text) return s.conn.close(1009);
		if (!this.allow(s)) return;
		let m;
		try {
			m = JSON.parse(text);
		} catch {
			return;
		}
		if (!m || typeof m !== "object") return;
		if (m.t === "ping") return s.push({ t: "pong" });
		if (m.t === "hello") {
			if (s.uid) return;
			const uid = typeof m.token === "string" && typeof m.apikey === "string" ? await this.opts.verify(m.token, m.apikey) : null;
			if (!uid) {
				s.push({
					t: "error",
					reason: "unauthorized"
				});
				return s.conn.close(4001);
			}
			const open = this.conns.get(uid) ?? 0;
			if (open >= LIMIT.connPerUser) {
				s.push({
					t: "error",
					reason: "too-many"
				});
				return s.conn.close(4002);
			}
			this.conns.set(uid, open + 1);
			s.uid = uid;
			return s.push({
				t: "hello-ok",
				referees: Object.keys(this.opts.referees ?? {})
			});
		}
		if (!s.uid) return;
		switch (m.t) {
			case "join": return this.join(s, m);
			case "leave": return this.leave(s, m.room);
			case "send": return this.relay(s, m.room, m.msg);
			case "referee": return this.startReferee(s, m.room, m.game, m.setup);
			case "ready": return this.setMeta(s, m.room, "guest", (mem) => mem.ready = m.ready === true);
			case "info": return this.setMeta(s, m.room, "host", (mem) => mem.info = clean$1(m.info, 40) || void 0);
			case "move": return this.move(s, m.room, m.move);
			case "advertise": return this.advertise(s, m.list, m.info);
			case "watch": return this.watch(s, m.list);
			case "unwatch": return this.unwatch(s, m.list);
		}
	}
	join(s, m) {
		const fail = (reason) => s.push({
			t: "join-error",
			ref: m.ref,
			reason
		});
		const now = this.now();
		const bad = (this.badJoins.get(s.uid) ?? []).filter((t) => now - t < LIMIT.badJoinWindowMs);
		if (m.role === "guest" && bad.length >= LIMIT.badJoins) return fail("not-found");
		const failJoin = () => {
			this.badJoins.set(s.uid, [...bad, now]);
			return fail("not-found");
		};
		if (typeof m.game !== "string" || !GAME_RE.test(m.game) || typeof m.code !== "string") return fail("not-found");
		const [id, pin = null, ...rest] = m.code.split("-");
		if (!ID_RE.test(id) || rest.length || pin !== null && !PIN_RE.test(pin)) return fail("not-found");
		if (m.role !== "host" && m.role !== "guest") return fail("not-found");
		const topic = `${m.game}:${id}`;
		if (s.rooms.has(topic)) this.leave(s, topic);
		if (s.rooms.size >= LIMIT.rooms) return fail("full");
		let room = this.rooms.get(topic);
		if (room && typeof m.resume === "string") {
			const mem = [...room.members.values()].find((x) => x.resume === m.resume && x.role === m.role);
			if (mem) {
				if (mem.session && mem.session !== s) mem.session.rooms.delete(topic);
				if (mem.grace) clearTimeout(mem.grace);
				mem.grace = null;
				mem.session = s;
				s.rooms.set(topic, mem.key);
				s.push({
					t: "joined",
					ref: m.ref,
					room: topic,
					key: mem.key,
					resume: mem.resume
				});
				return this.pushMembers(room);
			}
		}
		const hostOf = (r) => [...r.members.values()].find((x) => x.role === "host");
		if (m.role === "host") {
			if (room && hostOf(room)) return fail("full");
			if (room) this.dropRoom(room);
			room = {
				topic,
				id,
				pin,
				capacity: Number.isInteger(m.capacity) ? Math.min(LIMIT.capacity, Math.max(2, m.capacity)) : 2,
				members: /* @__PURE__ */ new Map(),
				referee: null,
				lastActive: this.now()
			};
			this.rooms.set(topic, room);
		} else {
			if (!room || !hostOf(room) || room.pin !== pin) return failJoin();
			if (room.members.size >= room.capacity) return fail("full");
		}
		const mem = {
			key: randomKey(m.role),
			resume: randomKey("r"),
			session: s,
			role: m.role,
			nickname: clean$1(m.nickname, 20).trim() || "익명",
			avatar: clean$1(m.avatar, 48) || void 0,
			joinedAt: this.now(),
			grace: null
		};
		room.members.set(mem.key, mem);
		room.lastActive = this.now();
		s.rooms.set(topic, mem.key);
		s.push({
			t: "joined",
			ref: m.ref,
			room: topic,
			key: mem.key,
			resume: mem.resume
		});
		this.pushMembers(room);
	}
	memberOf(s, topic) {
		if (typeof topic !== "string") return null;
		const key = s.rooms.get(topic);
		const room = key ? this.rooms.get(topic) : void 0;
		const mem = key ? room?.members.get(key) : void 0;
		return room && mem ? {
			room,
			mem
		} : null;
	}
	relay(s, topic, msg) {
		const at = this.memberOf(s, topic);
		if (!at) return;
		at.room.lastActive = this.now();
		if (at.room.referee?.ref.input(at.mem.key, msg)) return;
		for (const other of at.room.members.values()) if (other !== at.mem) other.session?.push({
			t: "msg",
			room: topic,
			from: at.mem.key,
			msg
		});
	}
	startReferee(s, topic, game, setup) {
		const at = this.memberOf(s, topic);
		if (!at || at.mem.role !== "host" || typeof game !== "string" || JSON.stringify(setup ?? null).length > 8e3) return;
		const factory = this.opts.referees?.[game];
		if (!factory || !topic.startsWith(`${game}:`)) return;
		const room = at.room;
		this.stopReferee(room);
		const ctx = {
			now: this.now,
			members: () => [...room.members.values()].map((m) => ({
				id: m.key,
				role: m.role,
				nickname: m.nickname,
				...m.avatar ? { avatar: m.avatar } : {}
			})),
			broadcast: (msg) => {
				for (const m of room.members.values()) m.session?.push({
					t: "msg",
					room: topic,
					from: REFEREE_FROM,
					msg
				});
			},
			sendTo: (key, msg) => room.members.get(key)?.session?.push({
				t: "msg",
				room: topic,
				from: REFEREE_FROM,
				msg
			})
		};
		let ref = null;
		try {
			ref = factory(setup, ctx);
		} catch (e) {
			console.warn("[hub] 심판 만들기 실패", game, e);
		}
		if (!ref) return;
		const timer = setInterval(() => {
			try {
				room.lastActive = this.now();
				ref.tick(this.now());
				if (ref.finished()) this.stopReferee(room);
			} catch (e) {
				console.warn("[hub] 심판 오류", game, e);
				this.stopReferee(room);
			}
		}, this.opts.tickMs ?? 50);
		room.referee = {
			game,
			ref,
			timer
		};
	}
	stopReferee(room) {
		if (!room.referee) return;
		clearInterval(room.referee.timer);
		room.referee = null;
	}
	setMeta(s, topic, role, change) {
		const at = this.memberOf(s, topic);
		if (!at || at.mem.role !== role) return;
		change(at.mem);
		this.pushMembers(at.room);
	}
	move(s, topic, move) {
		const at = this.memberOf(s, topic);
		if (!at || at.mem.role !== "host" || JSON.stringify(move ?? null).length > 500) return;
		for (const other of at.room.members.values()) if (other !== at.mem) other.session?.push({
			t: "move",
			room: topic,
			from: at.mem.key,
			move
		});
	}
	advertise(s, list, info) {
		if (typeof list !== "string" || !LIST_RE.test(list)) return;
		const old = s.adverts.get(list);
		if (info === null) {
			if (old) this.removeAdvert(list, old);
			s.adverts.delete(list);
			return;
		}
		if (!info || typeof info !== "object" || JSON.stringify(info).length > LIMIT.advertText) return;
		const topic = [...s.rooms.keys()].find((t) => {
			const room = this.rooms.get(t);
			const key = s.rooms.get(t);
			return room && room.id === info.id && key && room.members.get(key)?.role === "host";
		});
		if (!topic) return;
		if (!old && s.adverts.size >= LIMIT.adverts) return;
		if (old && old !== topic) this.removeAdvert(list, old);
		s.adverts.set(list, topic);
		let entries = this.lists.get(list);
		if (!entries) this.lists.set(list, entries = /* @__PURE__ */ new Map());
		entries.set(topic, info);
		this.pushList(list);
	}
	removeAdvert(list, topic) {
		const entries = this.lists.get(list);
		if (!entries?.delete(topic)) return;
		if (entries.size === 0) this.lists.delete(list);
		this.pushList(list);
	}
	watch(s, list) {
		if (typeof list !== "string" || !LIST_RE.test(list) || s.watches.has(list) || s.watches.size >= LIMIT.watches) return;
		s.watches.add(list);
		let set = this.watchers.get(list);
		if (!set) this.watchers.set(list, set = /* @__PURE__ */ new Set());
		set.add(s);
		s.push({
			t: "rooms",
			list,
			rooms: [...this.lists.get(list)?.values() ?? []]
		});
	}
	unwatch(s, list) {
		s.watches.delete(list);
		const set = this.watchers.get(list);
		set?.delete(s);
		if (set?.size === 0) this.watchers.delete(list);
	}
	pushList(list) {
		const rooms = [...this.lists.get(list)?.values() ?? []];
		for (const s of this.watchers.get(list) ?? []) s.push({
			t: "rooms",
			list,
			rooms
		});
	}
	pushMembers(room) {
		const members = [...room.members.values()].map((m) => ({
			id: m.key,
			nickname: m.nickname,
			role: m.role,
			joinedAt: m.joinedAt,
			...m.avatar ? { avatar: m.avatar } : {},
			...m.ready ? { ready: true } : {},
			...m.info ? { info: m.info } : {}
		}));
		for (const m of room.members.values()) m.session?.push({
			t: "members",
			room: room.topic,
			members
		});
	}
	/** 사람 하나를 방에서 뺀다. 방장이면 그 방 목록 줄도 내린다 */
	removeMember(room, mem) {
		if (mem.grace) clearTimeout(mem.grace);
		room.members.delete(mem.key);
		mem.session?.rooms.delete(room.topic);
		room.referee?.ref.leave(mem.key);
		if (mem.role === "host") {
			for (const [list, entries] of this.lists) if (entries.has(room.topic)) this.removeAdvert(list, room.topic);
			if (mem.session) {
				for (const [list, t] of mem.session.adverts) if (t === room.topic) mem.session.adverts.delete(list);
			}
		}
		if (room.members.size === 0) {
			this.stopReferee(room);
			this.rooms.delete(room.topic);
		} else this.pushMembers(room);
	}
	dropRoom(room) {
		for (const mem of [...room.members.values()]) this.removeMember(room, mem);
		this.rooms.delete(room.topic);
	}
	leave(s, topic) {
		const at = this.memberOf(s, topic);
		if (at) this.removeMember(at.room, at.mem);
	}
	closeSession(s) {
		if (s.uid) {
			const n = (this.conns.get(s.uid) ?? 1) - 1;
			if (n <= 0) this.conns.delete(s.uid);
			else this.conns.set(s.uid, n);
		}
		for (const list of [...s.watches]) this.unwatch(s, list);
		for (const [topic, key] of s.rooms) {
			const room = this.rooms.get(topic);
			const mem = room?.members.get(key);
			if (!room || !mem) continue;
			mem.session = null;
			mem.grace = setTimeout(() => {
				if (this.rooms.get(topic) === room && room.members.get(key) === mem && !mem.session) this.removeMember(room, mem);
			}, this.opts.graceMs ?? 2e4);
		}
		s.rooms.clear();
	}
};
//#endregion
//#region src/shared/random.ts
function createRng(seed) {
	let s = seed >>> 0;
	return {
		next() {
			s = s + 1831565813 >>> 0;
			let t = s;
			t = Math.imul(t ^ t >>> 15, t | 1);
			t ^= t + Math.imul(t ^ t >>> 7, t | 61);
			return ((t ^ t >>> 14) >>> 0) / 4294967296;
		},
		seed: () => s
	};
}
function chance(rng, p) {
	return rng.next() < p;
}
function pickOne(rng, values) {
	return values[Math.floor(rng.next() * values.length)];
}
/** 가중치에 따라 하나를 고른다. */
function pickWeighted(rng, weights) {
	const entries = Object.entries(weights);
	const total = entries.reduce((sum, [, w]) => sum + w, 0);
	let r = rng.next() * total;
	for (const [value, w] of entries) {
		r -= w;
		if (r < 0) return value;
	}
	return entries[entries.length - 1][0];
}
//#endregion
//#region src/games/armwrestle/constants.ts
/** 한 판 최대 시간. 끝나면 더 넘긴 쪽이 이김 */
const ROUND_MS = 15e3;
/** 판 시작 전 3·2·1 */
const COUNTDOWN_MS$4 = 2400;
/** 판 결과 보여주기 */
const ROUND_END_MS = 1800;
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
const DONE_MS$12 = 1800;
/** 연타전: 한 번 누를 때 넘어가는 양 */
const TAP_PUSH = .05;
/** 봇 연타 속도(초당) */
const BOT_TAP_RATE = {
	normal: 5.5,
	hard: 7.5
};
//#endregion
//#region src/games/armwrestle/bot/armBot.ts
/** 다음 연타까지 걸리는 시간 (평균 속도에서 ±30% 흔듦) */
function botTapGap(rng, difficulty) {
	return 1e3 / BOT_TAP_RATE[difficulty] * (.7 + rng.next() * .6);
}
const GRADE_WEIGHTS = {
	normal: {
		perfect: 10,
		great: 30,
		good: 35,
		miss: 25
	},
	hard: {
		perfect: 30,
		great: 40,
		good: 25,
		miss: 5
	}
};
function botGrade(rng, difficulty) {
	return pickWeighted(rng, GRADE_WEIGHTS[difficulty]);
}
//#endregion
//#region src/games/armwrestle/rules/timing.ts
/** 과녁 한가운데에서 떨어진 정도(게이지 끝까지 = 1) 이내면 그 판정. 위에서부터 (처음 0.08/0.2/0.4는 너무 쉬워 반쯤으로 좁힘) */
const GRADES = [
	{
		grade: "perfect",
		within: .04,
		push: .16
	},
	{
		grade: "great",
		within: .1,
		push: .1
	},
	{
		grade: "good",
		within: .22,
		push: .05
	}
];
function pushOf(grade) {
	return GRADES.find((g) => g.grade === grade)?.push ?? 0;
}
/** 당기기를 시작한 뒤 elapsed ms에서 몇 번째 지나감인지, 막대 위치(−1~1) */
function markerAt(elapsed) {
	const t = Math.max(0, elapsed);
	const pass = Math.floor(t / 750);
	const u = t % 750 / 750;
	return {
		pass,
		x: pass % 2 === 0 ? -1 + 2 * u : 1 - 2 * u
	};
}
/** 과녁 한가운데가 놓일 수 있는 범위 (−0.6 ~ 0.6) */
const ZONE_RANGE = .6;
/** zoneSeed로 정해지는 n번째 과녁(이번 판에서 n번 누른 뒤)의 위치. 같은 시드·번호면 늘 같다 */
function zoneCenter(zoneSeed, n) {
	return (createRng(zoneSeed + Math.imul(n + 1, 2654435769) >>> 0).next() * 2 - 1) * ZONE_RANGE;
}
/** 과녁이 center에 있을 때 elapsed에 누른 판정 */
function gradeAt(elapsed, center) {
	const { pass, x } = markerAt(elapsed);
	const off = Math.abs(x - center);
	return {
		pass,
		grade: GRADES.find((g) => off <= g.within)?.grade ?? "miss"
	};
}
//#endregion
//#region src/games/armwrestle/play/matchState.ts
const COUNT_STEP_MS = COUNTDOWN_MS$4 / 3;
function withSounds$2(state, ...names) {
	let seq = state.soundSeq;
	const added = names.map((name) => ({
		id: ++seq,
		name
	}));
	return {
		...state,
		sounds: [...state.sounds, ...added].slice(-12),
		soundSeq: seq
	};
}
function countdown$2(state) {
	return withSounds$2({
		...state,
		phase: {
			kind: "countdown",
			until: state.now + COUNTDOWN_MS$4,
			shown: 3
		}
	}, "count");
}
function createMatch$2(opts) {
	return countdown$2({
		now: opts.now,
		seed: opts.seed,
		event: opts.event,
		difficulty: opts.difficulty,
		controllers: opts.controllers ?? ["user", "bot"],
		follow: opts.follow ?? false,
		round: 1,
		wins: [0, 0],
		pos: 0,
		shownPos: 0,
		phase: {
			kind: "countdown",
			until: 0,
			shown: 3
		},
		taps: [0, 0],
		zoneSeed: 0,
		shots: 0,
		pressed: [-1, -1],
		lastGrade: [null, null],
		perfects: [0, 0],
		botNextAt: 0,
		sounds: [],
		soundSeq: 0
	});
}
const set = (pair, side, value) => side === 0 ? [value, pair[1]] : [pair[0], value];
/** 위치를 옮기고, 끝까지 넘어가면 판을 끝낸다. side 쪽으로 amount만큼 */
function push(state, side, amount) {
	if (state.follow || state.phase.kind !== "pull" || amount <= 0) return state;
	const pos = Math.max(-1, Math.min(1, state.pos + (side === 0 ? amount : -amount)));
	const next = {
		...state,
		pos
	};
	if (pos >= 1) return endRound(next, 0);
	if (pos <= -1) return endRound(next, 1);
	return next;
}
function endRound(state, winner) {
	const wins = winner === null ? state.wins : set(state.wins, winner, state.wins[winner] + 1);
	const userSide = state.controllers.indexOf("user");
	return withSounds$2({
		...state,
		wins,
		phase: {
			kind: "roundEnd",
			winner,
			until: state.now + ROUND_END_MS
		}
	}, winner === null ? "miss" : winner === userSide ? "roundWin" : "roundLose");
}
function afterRound(state) {
	const champ = state.wins.findIndex((w) => w >= 2);
	if (champ >= 0) {
		const winner = champ;
		const userSide = state.controllers.indexOf("user");
		return withSounds$2({
			...state,
			phase: {
				kind: "done",
				winner,
				until: state.now + DONE_MS$12
			}
		}, winner === userSide ? "win" : "lose");
	}
	return countdown$2({
		...state,
		round: state.round + 1,
		pos: 0
	});
}
/** 이번 판 과녁 시드를 새로 뽑는다 */
function newZones(state) {
	const rng = createRng(state.seed);
	const zoneSeed = Math.floor(rng.next() * 2 ** 32);
	return {
		...state,
		seed: rng.seed(),
		zoneSeed,
		shots: 0
	};
}
function startPull(state) {
	return withSounds$2({
		...newZones(state),
		pressed: [-1, -1],
		lastGrade: [null, null],
		botNextAt: state.now + 250,
		phase: {
			kind: "pull",
			start: state.now,
			until: state.now + ROUND_MS
		}
	}, "go");
}
/** 봇: 연타전은 정해진 간격으로 누르고, 타이밍전은 지나갈 때마다 가운데쯤 한 번 */
function botAct(state) {
	const { phase } = state;
	if (phase.kind !== "pull") return state;
	let s = state;
	state.controllers.forEach((c, i) => {
		if (c !== "bot" || s.phase.kind !== "pull") return;
		const side = i;
		const rng = createRng(s.seed);
		if (s.event === "mash") while (s.phase.kind === "pull" && s.now >= s.botNextAt) {
			const at = s.botNextAt;
			s = push({
				...s,
				taps: set(s.taps, side, s.taps[side] + 1),
				botNextAt: at + botTapGap(rng, s.difficulty)
			}, side, TAP_PUSH);
		}
		else {
			const pass = Math.floor((s.now - phase.start - 375) / 750);
			if (pass > s.pressed[side]) {
				const grade = botGrade(rng, s.difficulty);
				s = applyGrade(s, side, pass, grade);
			}
		}
		s = {
			...s,
			seed: rng.seed()
		};
	});
	return s;
}
function applyGrade(state, side, pass, grade) {
	const next = {
		...state,
		pressed: set(state.pressed, side, pass),
		lastGrade: set(state.lastGrade, side, {
			grade,
			at: state.now
		}),
		perfects: grade === "perfect" ? set(state.perfects, side, state.perfects[side] + 1) : state.perfects
	};
	return push(side === state.controllers.indexOf("user") ? withSounds$2(next, grade) : next, side, pushOf(grade));
}
function tick$13(state) {
	if (state.follow) {
		const shownPos = state.shownPos + (state.pos - state.shownPos) * .3;
		return {
			...state,
			shownPos: Math.abs(state.pos - shownPos) < .002 ? state.pos : shownPos
		};
	}
	const next = advance$1(state);
	return next.shownPos === next.pos ? next : {
		...next,
		shownPos: next.pos
	};
}
function advance$1(state) {
	const { phase, now } = state;
	switch (phase.kind) {
		case "countdown": {
			if (now >= phase.until) return startPull(state);
			const shown = Math.ceil((phase.until - now) / COUNT_STEP_MS);
			return shown < phase.shown ? withSounds$2({
				...state,
				phase: {
					...phase,
					shown
				}
			}, "count") : state;
		}
		case "pull": {
			const s = botAct(state);
			if (s.phase.kind === "pull" && now >= s.phase.until) return endRound(s, s.pos > 0 ? 0 : s.pos < 0 ? 1 : null);
			return s;
		}
		case "roundEnd": return now >= phase.until ? afterRound(state) : state;
		case "done": return state;
	}
}
function tap(state) {
	if (state.event !== "mash" || state.phase.kind !== "pull") return state;
	return push(withSounds$2({
		...state,
		taps: set(state.taps, 0, state.taps[0] + 1)
	}, "tap"), 0, TAP_PUSH);
}
function press$1(state, at) {
	const { phase } = state;
	if (state.event !== "timing" || phase.kind !== "pull") return state;
	const { pass, grade } = gradeAt(at - phase.start, zoneOf(state));
	if (pass <= state.pressed[0]) return state;
	return applyGrade({
		...state,
		shots: state.shots + 1
	}, 0, pass, grade);
}
/** 타이밍전: 지금 내 과녁 위치 (−0.6 ~ 0.6) */
function zoneOf(state) {
	return zoneCenter(state.zoneSeed, state.shots);
}
function remoteTaps(state, total, side = 1) {
	const added = total - state.taps[side];
	if (added <= 0 || state.controllers[side] !== "remote") return state;
	return push({
		...state,
		taps: set(state.taps, side, total)
	}, side, added * TAP_PUSH);
}
function remotePress(state, pass, grade, side = 1) {
	if (state.controllers[side] !== "remote" || state.phase.kind !== "pull" || pass <= state.pressed[side]) return state;
	return applyGrade(state, side, pass, grade);
}
/** 친구: 방장 상태를 받아 따라간다. 단계가 바뀌면 그에 맞는 소리 */
function sync(state, s) {
	if (!state.follow || state.phase.kind === "done") return state;
	const { now } = state;
	const prev = state.phase;
	const changed = prev.kind !== s.phase || state.round !== s.round;
	let phase;
	switch (s.phase) {
		case "countdown": {
			const shown = Math.max(1, Math.ceil(s.left / COUNT_STEP_MS));
			phase = {
				kind: "countdown",
				until: now + s.left,
				shown
			};
			break;
		}
		case "pull": {
			const until = now + s.left;
			phase = {
				kind: "pull",
				start: prev.kind === "pull" && !changed ? prev.start : until - ROUND_MS,
				until
			};
			break;
		}
		case "roundEnd":
			phase = {
				kind: "roundEnd",
				winner: s.winner,
				until: now + s.left
			};
			break;
		case "done": phase = {
			kind: "done",
			winner: s.winner ?? 0,
			until: now + s.left
		};
	}
	let next = {
		...state,
		round: s.round,
		wins: s.wins,
		pos: s.pos,
		phase
	};
	if (s.foeGrade && s.foeGrade.pass > state.pressed[1]) next = {
		...next,
		pressed: set(next.pressed, 1, s.foeGrade.pass),
		lastGrade: set(next.lastGrade, 1, {
			grade: s.foeGrade.grade,
			at: now
		})
	};
	if (changed && s.phase === "pull") next = {
		...newZones(next),
		pressed: [-1, -1],
		lastGrade: [null, null]
	};
	if (!changed) {
		if (phase.kind === "countdown" && prev.kind === "countdown" && phase.shown < prev.shown) return withSounds$2(next, "count");
		return next;
	}
	switch (s.phase) {
		case "countdown": return withSounds$2(next, "count");
		case "pull": return withSounds$2(next, "go");
		case "roundEnd": return withSounds$2(next, s.winner === null ? "miss" : s.winner === 0 ? "roundWin" : "roundLose");
		case "done": return withSounds$2(next, s.winner === 0 ? "win" : "lose");
	}
}
function matchReducer$2(state, action) {
	switch (action.type) {
		case "tick": return tick$13({
			...state,
			now: action.now
		});
		case "tap": return tap(state);
		case "press": return press$1(state, action.at);
		case "remoteTaps": return remoteTaps(state, action.total, action.side);
		case "remotePress": return remotePress(state, action.pass, action.grade, action.side);
		case "sync": return sync(state, action.sync);
	}
}
/** 지금 단계가 끝나기까지 남은 시간 */
function phaseLeft(state) {
	return Math.max(0, state.phase.until - state.now);
}
//#endregion
//#region src/games/armwrestle/play/pvp.ts
/** 방장: 지금 상태를 친구에게 보낼 메시지 */
function hostSync(state) {
	const { phase } = state;
	const winner = phase.kind === "roundEnd" || phase.kind === "done" ? phase.winner : null;
	const g = state.lastGrade[0];
	return {
		t: "sync",
		round: state.round,
		wins: state.wins,
		pos: state.pos,
		phase: phase.kind,
		left: phaseLeft(state),
		winner: winner === null ? null : winner === 0 ? "host" : "guest",
		hostGrade: g && state.pressed[0] >= 0 ? {
			pass: state.pressed[0],
			grade: g.grade
		} : null
	};
}
/** 방장: 단계나 판이 바뀌었으면 바로 보낸다 (그 밖엔 0.1초마다) */
function phaseChanged(prev, next) {
	return prev.phase.kind !== next.phase.kind || prev.round !== next.round;
}
/** 서버 심판: 받는 사람에게 보낼 상태 (친구에겐 예전 방장 상태 그대로, 방장에겐 상대 = 친구 판정) */
function serverSync(state, to) {
	const msg = hostSync(state);
	if (to === "guest" || msg.t !== "sync") return msg;
	const g = state.lastGrade[1];
	return {
		...msg,
		hostGrade: g && state.pressed[1] >= 0 ? {
			pass: state.pressed[1],
			grade: g.grade
		} : null
	};
}
//#endregion
//#region src/shared/art3d/animalKinds.ts
/** 고르지 않은 사람·봇은 아무도 안 고른 동물을 이 순서로 받는다 */
const ANIMALS = [
	"bear",
	"cat",
	"fox",
	"rabbit",
	"panda",
	"dog",
	"pig",
	"frog",
	"tiger",
	"lion",
	"eagle",
	"seagull",
	"penguin",
	"dino",
	"wolf",
	"elephant"
];
/** 모르는 값(옛 저장값·남이 보낸 이상한 값)은 버린다 */
function asAnimal(x) {
	return typeof x === "string" && ANIMALS.includes(x) ? x : void 0;
}
const HATS = [
	"none",
	"cap",
	"crown",
	"party",
	"beanie",
	"tophat"
];
const GLASSES = [
	"none",
	"round",
	"sun",
	"star"
];
const NECKS = [
	"none",
	"bow",
	"scarf",
	"tie"
];
const FURS = [
	"base",
	"light",
	"dark"
];
const OUTFITS = ["shirt", "uniform"];
const TINTS = [
	"red",
	"orange",
	"yellow",
	"green",
	"sky",
	"blue",
	"navy",
	"purple",
	"pink",
	"burgundy",
	"black"
];
/** 등번호 0~99 */
const clampNumber = (n) => {
	const x = Math.floor(Number(n));
	return Number.isFinite(x) ? Math.min(99, Math.max(0, x)) : 7;
};
const pick$3 = (list, x, fallback) => typeof x === "string" && list.includes(x) ? x : fallback;
/** 방으로 보낼 짧은 글자: '동물.모자.안경.목.털.옷.색.번호' */
const encodeLook = (l) => [
	l.animal,
	l.hat,
	l.glasses,
	l.neck,
	l.fur,
	l.outfit,
	l.tint,
	l.number
].join(".");
/** 받은 글자·저장값 → 캐릭터 (모르는 값은 버리거나 '없음') */
function decodeLook(x) {
	if (typeof x !== "string" || x.length > 48) return void 0;
	const [a, hat, glasses, neck, fur, outfit, tint, number] = x.split(".");
	const animal = asAnimal(a);
	if (!animal) return void 0;
	return {
		animal,
		hat: pick$3(HATS, hat, "none"),
		glasses: pick$3(GLASSES, glasses, "none"),
		neck: pick$3(NECKS, neck, "none"),
		fur: pick$3(FURS, fur, "base"),
		outfit: pick$3(OUTFITS, outfit, "shirt"),
		tint: pick$3(TINTS, tint, "red"),
		number: number === void 0 ? 7 : clampNumber(number)
	};
}
//#endregion
//#region src/server/referees/common.ts
const clean = (v, max) => typeof v === "string" ? [...v.replace(/[\u0000-\u001f\u007f]/g, "")].slice(0, max).join("").trim() : "";
function readLook(x) {
	if (!x || typeof x !== "object") return void 0;
	try {
		return decodeLook(encodeLook(x));
	} catch {
		return;
	}
}
/** 사람은 방에 있는 사람만 한 번씩, 봇은 'bot0'~'bot15'. 사람 이름은 서버가 아는 닉네임으로 */
function readPlayers(x, ctx, min, max) {
	if (!Array.isArray(x) || x.length < min || x.length > max) return null;
	const members = new Map(ctx.members().map((m) => [m.id, m]));
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const p of x) {
		if (!p || typeof p !== "object" || typeof p.id !== "string" || seen.has(p.id)) return null;
		seen.add(p.id);
		const avatar = readLook(p.avatar);
		const member = members.get(p.id);
		if (member) out.push({
			id: p.id,
			name: member.nickname,
			kind: "remote",
			avatar
		});
		else if (/^bot\d{1,2}$/.test(p.id)) out.push({
			id: p.id,
			name: clean(p.name, 20) || "봇",
			kind: "bot",
			avatar
		});
		else return null;
	}
	if (!out.some((p) => members.get(p.id)?.role === "host")) return null;
	return out;
}
/** 팀: 없으면 null(개인전), 모양이 틀리면 undefined */
function readTeams(x, n) {
	if (x === null || x === void 0) return null;
	if (!Array.isArray(x) || x.length !== n || !x.every((t) => t === 0 || t === 1)) return void 0;
	return x;
}
const serverSeed = () => crypto.getRandomValues(/* @__PURE__ */ new Uint32Array(1))[0];
//#endregion
//#region src/server/referees/armwrestle.ts
const EVENTS = ["mash", "timing"];
const GRADE_NAMES = [
	"perfect",
	"great",
	"good",
	"miss"
];
const SYNC_MS = 100;
function armwrestleReferee(setup, ctx) {
	const o = setup ?? {};
	const members = ctx.members();
	const host = members.find((m) => m.role === "host");
	const guest = members.find((m) => m.role === "guest");
	if (!host || !guest || !EVENTS.includes(o.event)) return null;
	let s = createMatch$2({
		now: ctx.now(),
		seed: serverSeed(),
		event: o.event,
		difficulty: "normal",
		controllers: ["remote", "remote"]
	});
	let sentAt = -Infinity;
	let doneAt = null;
	const send = () => {
		ctx.sendTo(host.id, serverSync(s, "host"));
		ctx.sendTo(guest.id, serverSync(s, "guest"));
		sentAt = s.now;
	};
	const step = (next) => {
		const prev = s;
		s = next;
		if (phaseChanged(prev, s) || s.now - sentAt >= SYNC_MS) send();
		if (doneAt === null && s.phase.kind === "done") doneAt = s.now;
	};
	send();
	return {
		input(from, msg) {
			const m = msg ?? {};
			if (m.t === "sync") return true;
			if (m.t !== "taps" && m.t !== "press") return false;
			const side = from === host.id ? 0 : from === guest.id ? 1 : null;
			if (side === null) return true;
			const now = ctx.now();
			const ticked = matchReducer$2(s, {
				type: "tick",
				now: Math.max(now, s.now)
			});
			if (m.t === "taps" && Number.isInteger(m.total) && m.total >= 0 && m.total < 1e5) step(matchReducer$2(ticked, {
				type: "remoteTaps",
				total: m.total,
				side
			}));
			else if (m.t === "press" && Number.isInteger(m.pass) && GRADE_NAMES.includes(m.grade)) step(matchReducer$2(ticked, {
				type: "remotePress",
				pass: m.pass,
				grade: m.grade,
				side
			}));
			return true;
		},
		tick(now) {
			step(matchReducer$2(s, {
				type: "tick",
				now: Math.max(now, s.now)
			}));
		},
		leave() {},
		finished: () => doneAt !== null && s.now - doneAt > 4e3
	};
}
//#endregion
//#region src/shared/team/teams.ts
/** 살아 있는 사람이 모두 한 팀이면 그 팀, 아니면 null (아무도 없으면 null) */
function lastTeam(alive, teams) {
	let found = null;
	for (let i = 0; i < alive.length; i++) {
		if (!alive[i]) continue;
		if (found === null) found = teams[i];
		else if (found !== teams[i]) return null;
	}
	return found;
}
/** 같은 팀인지 (팀전이 아니면 늘 false) */
const sameTeam = (teams, a, b) => !!teams && a !== b && teams[a] === teams[b];
//#endregion
//#region src/games/artillery/constants.ts
/** 물리: 고정 스텝, 중력, 힘 100일 때 포탄 속도, 바람(옆으로 미는 가속도) 최대 */
const STEP = 1 / 60;
const BARREL = 7.5;
/** 시간 (ms): 시작 안내, 한 차례, 터진 뒤 보여주기, 끝 */
const COUNTDOWN_MS$3 = 1500;
const TURN_MS$3 = 2e4;
const BOOM_MS$1 = 1600;
const DONE_MS$11 = 2500;
/** 봇이 생각하는 시간 */
const BOT_THINK_MS$1 = [1200, 2400];
//#endregion
//#region src/games/artillery/rules/physics.ts
/**
* 지형 모양 (판마다 무작위, 사용자 요청 — 처음엔 늘 물결 언덕이라 비슷해 보였음):
* 언덕(물결) · 큰 산(가운데 높은 봉우리) · 골짜기(양끝 높고 가운데 낮음) · 쌍봉 · 고원(평평한 대지 몇 개) · 울퉁불퉁
*/
const TERRAIN_SHAPES = [
	"hills",
	"mountain",
	"valley",
	"twin",
	"mesa",
	"rough"
];
/** 땅 색·하늘 (판마다 무작위): 풀밭 · 사막 · 눈밭 · 노을 · 밤 */
const LAND_THEMES = [
	"grass",
	"desert",
	"snow",
	"sunset",
	"night"
];
const pickOf = (rng, list) => list[Math.floor(rng.next() * list.length) % list.length];
const smooth = (e0, e1, x) => {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
	return t * t * (3 - 2 * t);
};
/** 판 하나의 땅: 모양·색을 고르고 지형을 만든다 */
function makeLand(rng) {
	const shape = pickOf(rng, TERRAIN_SHAPES);
	return {
		land: {
			shape,
			theme: pickOf(rng, LAND_THEMES)
		},
		terrain: makeTerrain(rng, shape)
	};
}
/** 지형: 모양마다 큰 틀을 잡고, 크기가 다른 물결을 겹쳐 자연스럽게 */
function makeTerrain(rng, shape = "hills") {
	const wave = (amp, len) => ({
		amp,
		len,
		phase: rng.next() * Math.PI * 2
	});
	const waves = [
		wave(shape === "hills" ? 16 + rng.next() * 10 : shape === "rough" ? 10 + rng.next() * 6 : 4 + rng.next() * 4, 120 + rng.next() * 80),
		wave(shape === "rough" ? 10 + rng.next() * 5 : shape === "mesa" ? 1.5 : 5 + rng.next() * 5, 45 + rng.next() * 25),
		wave(shape === "rough" ? 4 + rng.next() * 3 : 2 + rng.next() * 3, 14 + rng.next() * 8)
	];
	const W = 200;
	let frame;
	switch (shape) {
		case "mountain": {
			const c = W / 2 + (rng.next() - .5) * 40;
			const height = 34 + rng.next() * 12;
			const width = 22 + rng.next() * 14;
			const base = 26 + rng.next() * 8;
			frame = (x) => base + height * Math.exp(-(((x - c) / width) ** 2));
			break;
		}
		case "valley": {
			const edge = 62 + rng.next() * 12;
			const low = 22 + rng.next() * 8;
			frame = (x) => low + (edge - low) * (Math.abs(x / W - .5) * 2) ** 1.6;
			break;
		}
		case "twin": {
			const base = 26 + rng.next() * 6;
			const peaks = [W * (.3 + (rng.next() - .5) * .08), W * (.7 + (rng.next() - .5) * .08)];
			const hs = [26 + rng.next() * 14, 26 + rng.next() * 14];
			const width = 16 + rng.next() * 8;
			frame = (x) => base + peaks.reduce((sum, c, i) => sum + hs[i] * Math.exp(-(((x - c) / width) ** 2)), 0);
			break;
		}
		case "mesa": {
			const n = 3 + Math.floor(rng.next() * 2);
			const levels = Array.from({ length: n }, () => 26 + rng.next() * 40);
			const seg = W / n;
			frame = (x) => {
				const i = Math.min(n - 1, Math.floor(x / seg));
				const local = x - i * seg;
				let h = levels[i];
				if (i > 0) h += (levels[i - 1] - levels[i]) * (1 - smooth(0, 9, local));
				return h;
			};
			break;
		}
		default: {
			const base = 38 + rng.next() * 14;
			frame = () => base;
		}
	}
	return Array.from({ length: 201 }, (_, x) => {
		const h = waves.reduce((sum, w) => sum + w.amp * Math.sin(x / w.len * Math.PI * 2 + w.phase), frame(x));
		return Math.round(Math.min(82, Math.max(18, h)) * 10) / 10;
	});
}
/** x 자리 땅 높이 (사이는 이어서). 맵 밖이면 가장자리 높이 */
function heightAt(t, x) {
	const cx = Math.min(200, Math.max(0, x));
	const i = Math.min(199, Math.floor(cx));
	const f = cx - i;
	return t[i] * (1 - f) + t[i + 1] * f;
}
/** 대포가 땅 기울기를 따라 기운 각도 (라디안, + = 오른쪽이 높음). 바퀴 띠 양끝의 땅 높이로 잰다 */
const TILT_SPAN = 5;
const TILT_MAX = 40 * Math.PI / 180;
function tankTilt(t, x) {
	const a = Math.atan2(heightAt(t, x + TILT_SPAN) - heightAt(t, x - TILT_SPAN), 10);
	return Math.max(-TILT_MAX, Math.min(TILT_MAX, a));
}
/** 대포가 땅에 얹힌 모습: 기울기와, 바퀴 띠 밑면이 x 자리에서 있는 높이.
*  바퀴 띠(기운 직선)가 그 아래 땅 어디에도 파묻히지 않게 가장 높이 닿는 곳에 얹는다
*  (언덕 꼭대기에선 꼭대기에 올라타고, 골짜기에선 양쪽 가장자리에 걸침) */
function tankPose(t, x) {
	const tilt = tankTilt(t, x);
	const k = Math.tan(tilt);
	let y = heightAt(t, x);
	for (let dx = -5; dx <= TILT_SPAN; dx += .5) y = Math.max(y, heightAt(t, x + dx) - dx * k);
	return {
		y,
		tilt
	};
}
/** 대포 몸(포탑) 가운데: 땅에 얹힌 곳에서 기운 방향으로 TANK_CY 위 */
const tankCenter = (t, x) => {
	const { y, tilt } = tankPose(t, x);
	return {
		x: x - Math.sin(tilt) * 3,
		y: y + Math.cos(tilt) * 3
	};
};
/** 땅을 둥글게 판다 (원 아래쪽까지 깎임) */
function carve(t, c, r = 7) {
	const out = t.slice();
	for (let i = Math.max(0, Math.ceil(c.x - r)); i <= Math.min(200, Math.floor(c.x + r)); i++) {
		const bottom = c.y - Math.sqrt(Math.max(0, r * r - (i - c.x) ** 2));
		if (out[i] > bottom) out[i] = Math.max(0, Math.round(bottom * 10) / 10);
	}
	return out;
}
/** 포구: 대포 가운데에서 포신 길이만큼 각도 쪽으로 */
function muzzle(t, x, angleDeg) {
	const c = tankCenter(t, x);
	const a = angleDeg * Math.PI / 180;
	return {
		x: c.x + Math.cos(a) * BARREL,
		y: c.y + Math.sin(a) * BARREL
	};
}
/** 포탄 궤적: 각도(0 = 오른쪽, 90 = 위, 180 = 왼쪽), 힘(0~100), 바람(+ = 오른쪽으로 미는 가속도) */
function simulateShot(t, tanks, shooter, angleDeg, power, wind, maxSteps = Math.round(12 / STEP)) {
	const a = angleDeg * Math.PI / 180;
	const speed = power / 100 * 80;
	let { x, y } = muzzle(t, tanks[shooter].x, angleDeg);
	let vx = Math.cos(a) * speed;
	let vy = Math.sin(a) * speed;
	const path = [{
		x,
		y
	}];
	const centers = tanks.map((k) => k.alive ? tankCenter(t, k.x) : null);
	for (let step = 1; step <= maxSteps; step++) {
		vx += wind * STEP;
		vy -= 30 * STEP;
		x += vx * STEP;
		y += vy * STEP;
		for (let i = 0; i < centers.length; i++) {
			const c = centers[i];
			if (!c || i === shooter && step < 12) continue;
			if (Math.hypot(x - c.x, y - c.y) <= 4.5) {
				path.push({
					x,
					y
				});
				return {
					path,
					steps: step,
					impact: {
						x,
						y
					},
					direct: i
				};
			}
		}
		if (x >= 0 && x <= 200 && y <= heightAt(t, x)) {
			const impact = {
				x,
				y: heightAt(t, x)
			};
			path.push(impact);
			return {
				path,
				steps: step,
				impact,
				direct: null
			};
		}
		if (x < -40 || x > 240 || y < -40) {
			path.push({
				x,
				y
			});
			return {
				path,
				steps: step,
				impact: null,
				direct: null
			};
		}
		if (step % 2 === 0) path.push({
			x,
			y
		});
	}
	return {
		path,
		steps: maxSteps,
		impact: null,
		direct: null
	};
}
/** 폭발 피해: 가운데에서 멀수록 줄어든다 (DAMAGE_R 밖은 0) */
function blastDamage(impact, center) {
	const d = Math.hypot(impact.x - center.x, impact.y - center.y);
	return d >= 11 ? 0 : Math.round(45 * (1 - d / 11));
}
/** 터짐: 피해를 주고 땅을 판 뒤, 발밑이 꺼진 대포는 떨어진다 */
function explode$1(t, tanks, impact) {
	const damage = tanks.map((k) => k.alive ? blastDamage(impact, tankCenter(t, k.x)) : 0);
	const terrain = carve(t, impact);
	const fell = [];
	tanks.forEach((k, i) => {
		if (!k.alive) return;
		const before = heightAt(t, k.x);
		const after = heightAt(terrain, k.x);
		if (after <= 1) fell.push(i);
		const drop = before - after;
		if (drop > 5) damage[i] += Math.round((drop - 5) * 2);
	});
	return {
		terrain,
		damage,
		fell
	};
}
//#endregion
//#region src/games/artillery/bot/artilleryBot.ts
/** 손 떨림: 각도(도), 힘 */
const JITTER = {
	normal: {
		angle: 5,
		power: 7
	},
	hard: {
		angle: 1.2,
		power: 1.8
	}
};
function chooseBotAim(rng, terrain, tanks, me, wind, level, teams = null) {
	const myPos = tankCenter(terrain, tanks[me].x);
	const enemies = tanks.map((t, i) => ({
		t,
		i
	})).filter(({ t, i }) => t.alive && i !== me && !sameTeam(teams, me, i));
	if (enemies.length === 0) return {
		angle: 90,
		power: 30
	};
	enemies.sort((a, b) => Math.abs(a.t.x - tanks[me].x) - Math.abs(b.t.x - tanks[me].x));
	const target = level === "hard" ? [...enemies.slice(0, 2)].sort((a, b) => a.t.hp - b.t.hp)[0] : enemies[0];
	const goal = tankCenter(terrain, target.t.x);
	const right = goal.x >= myPos.x;
	let best = {
		angle: right ? 45 : 135,
		power: 60,
		miss: Infinity
	};
	for (let a = 15; a <= 80; a += 2.5) {
		const angle = right ? a : 180 - a;
		for (let power = 15; power <= 100; power += 2) {
			const s = simulateShot(terrain, tanks, me, angle, power, wind);
			if (!s.impact) continue;
			if (Math.hypot(s.impact.x - myPos.x, s.impact.y - myPos.y) < 11) continue;
			const miss = Math.hypot(s.impact.x - goal.x, s.impact.y - goal.y);
			if (miss < best.miss) best = {
				angle,
				power,
				miss
			};
		}
	}
	const j = JITTER[level];
	const angle = Math.min(180, Math.max(0, best.angle + (rng.next() * 2 - 1) * j.angle));
	const power = Math.min(100, Math.max(5, best.power + (rng.next() * 2 - 1) * j.power));
	return {
		angle: Math.round(angle * 10) / 10,
		power: Math.round(power * 10) / 10
	};
}
//#endregion
//#region src/games/artillery/play/engine.ts
const aliveIndexes$4 = (s) => s.tanks.flatMap((t, i) => t.alive ? [i] : []);
const within$5 = (rng, [min, max]) => min + rng.next() * (max - min);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const round1 = (v) => Math.round(v * 10) / 10;
/** 대포 자리: 맵을 사람 수만큼 나눠 칸마다 한 명 (조금씩 흔들고, 누가 어디일지는 섞는다) */
function startSpots(rng, n) {
	const seg = 170 / n;
	const spots = Array.from({ length: n }, (_, i) => round1(15 + seg * (i + .5) + (rng.next() - .5) * seg * .4));
	for (let i = spots.length - 1; i > 0; i--) {
		const j = Math.floor(rng.next() * (i + 1));
		[spots[i], spots[j]] = [spots[j], spots[i]];
	}
	return spots;
}
function createEngine$9(opts) {
	const rng = createRng(opts.seed);
	const { land, terrain } = makeLand(rng);
	const tanks = startSpots(rng, opts.players.length).map((x) => ({
		x,
		hp: 100,
		alive: true,
		angle: x < 100 ? 45 : 135,
		power: 60
	}));
	const turn = Math.floor(rng.next() * opts.players.length);
	return {
		now: opts.now,
		seed: rng.seed(),
		level: opts.level ?? "normal",
		players: opts.players,
		teams: opts.teams ?? null,
		friendlyFire: !!opts.friendlyFire,
		tanks,
		terrain,
		land,
		turn,
		turnNo: 0,
		wind: 0,
		out: [],
		kills: opts.players.map(() => 0),
		botAt: null,
		phase: {
			kind: "countdown",
			until: opts.now + COUNTDOWN_MS$3
		}
	};
}
/** 끝났는지: 한 명 남음, 팀전이면 한 팀만 남음 */
function isOver$4(s) {
	return aliveIndexes$4(s).length <= 1 || !!s.teams && lastTeam(s.tanks.map((t) => t.alive), s.teams) !== null;
}
/** 이긴 팀 (팀전이고 끝났을 때) */
function winnerTeam$5(s) {
	return s.teams ? lastTeam(s.tanks.map((t) => t.alive), s.teams) : null;
}
/** 차례 시작: 바람을 새로 정하고, 봇이면 쏠 시각을 정한다 */
function startTurn$2(s, turn) {
	const rng = createRng(s.seed);
	const wind = round1((rng.next() * 2 - 1) * 8);
	const botAt = s.players[turn].kind === "bot" ? s.now + within$5(rng, BOT_THINK_MS$1) : null;
	return {
		...s,
		seed: rng.seed(),
		turn,
		turnNo: s.turnNo + 1,
		wind,
		botAt,
		phase: {
			kind: "aim",
			until: s.now + TURN_MS$3,
			startX: s.tanks[turn].x
		}
	};
}
function nextAlive$2(s, from) {
	for (let k = 1; k <= s.players.length; k++) {
		const i = (from + k) % s.players.length;
		if (s.tanks[i].alive) return i;
	}
	return from;
}
/** 조준 값 정리: 움직일 수 있는 범위·각도·힘 안으로 */
function setAim(s, player, x, angle, power) {
	if (s.phase.kind !== "aim" || player !== s.turn || !s.tanks[player].alive) return s;
	const { startX } = s.phase;
	const tank = {
		...s.tanks[player],
		x: round1(clamp(x, Math.max(3, startX - 14), Math.min(197, startX + 14))),
		angle: round1(clamp(angle, 0, 180)),
		power: round1(clamp(power, 5, 100))
	};
	return {
		...s,
		tanks: s.tanks.map((t, i) => i === player ? tank : t)
	};
}
/** 발사: 궤적을 미리 다 계산해 두고, 날아가는 시간만큼 보여준다 */
function launch(s) {
	const t = s.tanks[s.turn];
	const shot = simulateShot(s.terrain, s.tanks, s.turn, t.angle, t.power, s.wind);
	const ms = Math.max(300, shot.steps * STEP * 1e3);
	return {
		...s,
		botAt: null,
		phase: {
			kind: "flight",
			until: s.now + ms,
			shot
		}
	};
}
/** 터짐: 피해·땅 파임·떨어짐을 반영하고 탈락자를 정한다 */
function land$1(s, shot) {
	if (!shot.impact) return {
		...s,
		phase: {
			kind: "boom",
			until: s.now + BOOM_MS$1,
			boom: {
				at: null,
				damage: s.tanks.map(() => 0),
				dead: [],
				fell: []
			}
		}
	};
	const blast = explode$1(s.terrain, s.tanks, shot.impact);
	if (s.teams && !s.friendlyFire) blast.damage = blast.damage.map((d, i) => sameTeam(s.teams, s.turn, i) ? 0 : d);
	const tanks = s.tanks.map((t, i) => {
		if (!t.alive) return t;
		const hp = Math.max(0, t.hp - blast.damage[i]);
		return {
			...t,
			hp: blast.fell.includes(i) ? 0 : hp,
			alive: hp > 0 && !blast.fell.includes(i)
		};
	});
	const dead = tanks.flatMap((t, i) => s.tanks[i].alive && !t.alive ? [i] : []);
	const kills = s.kills.map((k, i) => i === s.turn ? k + dead.filter((d) => d !== s.turn).length : k);
	return {
		...s,
		terrain: blast.terrain,
		tanks,
		kills,
		out: dead.length ? [...s.out, dead] : s.out,
		phase: {
			kind: "boom",
			until: s.now + BOOM_MS$1,
			boom: {
				at: shot.impact,
				damage: blast.damage,
				dead,
				fell: blast.fell
			}
		}
	};
}
function afterBoom$1(s) {
	if (isOver$4(s)) return {
		...s,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$11
		}
	};
	return startTurn$2(s, nextAlive$2(s, s.turn));
}
function drop$9(s, player) {
	if (!s.tanks[player].alive || s.phase.kind === "done") return s;
	const next = {
		...s,
		tanks: s.tanks.map((t, i) => i === player ? {
			...t,
			hp: 0,
			alive: false
		} : t),
		out: [...s.out, [player]]
	};
	if (isOver$4(next)) return {
		...next,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$11
		}
	};
	if (s.phase.kind === "aim" && s.turn === player) return startTurn$2(next, nextAlive$2(next, player));
	return next;
}
function tick$12(s) {
	const { phase, now } = s;
	switch (phase.kind) {
		case "countdown": return now >= phase.until ? startTurn$2(s, s.turn) : s;
		case "aim":
			if (s.botAt !== null && now >= s.botAt) {
				const rng = createRng(s.seed);
				const aim = chooseBotAim(rng, s.terrain, s.tanks, s.turn, s.wind, s.level, s.teams);
				const t = s.tanks[s.turn];
				return launch(setAim({
					...s,
					seed: rng.seed()
				}, s.turn, t.x, aim.angle, aim.power));
			}
			return now >= phase.until ? launch(s) : s;
		case "flight": return now >= phase.until ? land$1(s, phase.shot) : s;
		case "boom": return now >= phase.until ? afterBoom$1(s) : s;
		case "done": return s;
	}
}
function engineReducer$9(state, action) {
	switch (action.type) {
		case "tick": return tick$12({
			...state,
			now: action.now
		});
		case "aim": return setAim(state, action.player, action.x, action.angle, action.power);
		case "fire":
			if (state.phase.kind !== "aim" || action.player !== state.turn || !state.tanks[action.player].alive) return state;
			return launch(setAim(state, action.player, action.x, action.angle, action.power));
		case "drop": return drop$9(state, action.player);
	}
}
/** 사람별 등수 (1 = 우승). 끝나기 전이면 남은 사람은 모두 1 */
function ranksOf$6(s) {
	const ranks = s.players.map(() => 1);
	let next = aliveIndexes$4(s).length + 1;
	for (const group of [...s.out].reverse()) {
		for (const i of group) ranks[i] = next;
		next += group.length;
	}
	return ranks;
}
//#endregion
//#region src/games/artillery/play/view.ts
function toView$7(s) {
	const { phase, now } = s;
	return {
		players: s.players.map(({ id, name, avatar }) => ({
			id,
			name,
			...avatar ? { avatar } : {}
		})),
		teams: s.teams,
		winTeam: s.phase.kind === "done" ? winnerTeam$5(s) : null,
		tanks: s.tanks.map(({ x, hp, alive, angle, power }) => ({
			x,
			hp,
			alive,
			angle,
			power
		})),
		terrain: s.terrain,
		land: s.land,
		turn: s.turn,
		turnNo: s.turnNo,
		wind: s.wind,
		phase: phase.kind,
		leftMs: Math.max(0, phase.until - now),
		startX: phase.kind === "aim" ? phase.startX : null,
		shot: phase.kind === "flight" ? phase.shot : null,
		boom: phase.kind === "boom" ? phase.boom : null,
		kills: s.kills,
		ranks: ranksOf$6(s)
	};
}
/** 친구에게 바로 알려야 할 만큼 바뀌었는지 (차례인 사람이 움직이거나 겨누는 것도) */
function viewChanged$6(a, b) {
	if (!a) return true;
	if (a.phase !== b.phase || a.turnNo !== b.turnNo) return true;
	const ta = a.tanks[b.turn];
	const tb = b.tanks[b.turn];
	return ta.x !== tb.x || ta.angle !== tb.angle || ta.power !== tb.power;
}
//#endregion
//#region src/server/referees/hostEngine.ts
const HEARTBEAT_MS = 1e3;
/** 끝나고 이만큼 더 화면을 보낸 뒤 심판을 내린다 */
const LINGER_MS = 3e3;
function hostEngineReferee(ctx, spec) {
	let s = spec.state;
	let sent = {
		view: null,
		at: 0
	};
	let doneAt = null;
	const wrap = spec.wrap ?? ((v) => ({
		t: "view",
		v
	}));
	const flush = (force = false) => {
		const view = spec.toView(s);
		const now = spec.nowOf(s);
		if (force || spec.changed(sent.view, view) || now - sent.at >= HEARTBEAT_MS) {
			const viewFor = spec.viewFor;
			if (viewFor) for (const m of ctx.members()) ctx.sendTo(m.id, wrap(viewFor(view, m.id, s)));
			else ctx.broadcast(wrap(view));
			sent = {
				view,
				at: now
			};
		}
	};
	flush(true);
	let stopped = false;
	const later = (a) => {
		if (stopped) return;
		try {
			s = spec.reduce(spec.reduce(s, spec.tick(ctx.now())), a);
			flush();
		} catch (e) {
			console.warn("[referee] 나중 동작 무시", e);
		}
	};
	return {
		input(from, msg) {
			if (!msg || typeof msg !== "object") return false;
			try {
				const a = spec.input(s, from, msg, later);
				if (a === void 0) return false;
				if (a !== null) {
					s = spec.reduce(spec.reduce(s, spec.tick(ctx.now())), a);
					flush();
				}
			} catch (e) {
				console.warn("[referee] 입력 무시", e);
			}
			return true;
		},
		tick(now) {
			s = spec.reduce(s, spec.tick(now));
			if (doneAt === null && spec.done(s)) doneAt = now;
			flush();
		},
		leave(key) {
			const a = spec.drop(s, key);
			if (a) {
				s = spec.reduce(s, a);
				flush();
			}
		},
		finished: () => {
			const over = doneAt !== null && spec.nowOf(s) - doneAt > LINGER_MS;
			if (over) stopped = true;
			return over;
		}
	};
}
/** 사람 번호 (서버가 정한 접속 번호로, 사람 자리만) */
const humanIndex = (players, key) => players.findIndex((p) => p.id === key && p.kind === "remote");
const isInt$1 = (x) => typeof x === "number" && Number.isInteger(x);
//#endregion
//#region src/server/referees/validate.ts
const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const isInt = (x, min = -1e9, max = 1e9) => typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;
const isVec = (x) => !!x && typeof x === "object" && isNum(x.x) && isNum(x.y);
/** 숫자 잇기 바닥: 줄 최대 60개, 줄마다 최대 13장, 타일 번호 0~105 */
const isTable = (x) => Array.isArray(x) && x.length <= 60 && x.every((row) => Array.isArray(row) && row.length <= 13 && row.every((t) => isInt(t, 0, 105)));
//#endregion
//#region src/server/referees/artillery.ts
function artilleryReferee(setup, ctx) {
	const o = setup ?? {};
	const players = readPlayers(o.players, ctx, 2, 4);
	if (!players) return null;
	const teams = readTeams(o.teams, players.length);
	if (teams === void 0) return null;
	return hostEngineReferee(ctx, {
		state: createEngine$9({
			now: ctx.now(),
			seed: serverSeed(),
			players,
			teams,
			friendlyFire: o.friendlyFire === true,
			level: "normal"
		}),
		reduce: engineReducer$9,
		tick: (now) => ({
			type: "tick",
			now
		}),
		toView: toView$7,
		changed: viewChanged$6,
		input: (s, from, m) => {
			if (m.t !== "aim" && m.t !== "fire") return void 0;
			const player = humanIndex(s.players, from);
			if (player < 0 || m.turnNo !== s.turnNo || !isNum(m.x) || !isNum(m.angle) || !isNum(m.power)) return null;
			return {
				type: m.t,
				player,
				x: m.x,
				angle: m.angle,
				power: m.power
			};
		},
		drop: (s, key) => {
			const player = humanIndex(s.players, key);
			return player >= 0 ? {
				type: "drop",
				player
			} : null;
		},
		done: (s) => s.phase.kind === "done",
		nowOf: (s) => s.now
	});
}
//#endregion
//#region src/games/bomb/constants.ts
/** 폭탄이 터지기까지 (판마다 이 사이에서 무작위, 아무도 모름. 처음 7~16초는 늘 비슷하게 느껴져 넓힘) */
const FUSE_MS = [5e3, 2e4];
/** 판 시작 전 3·2·1 */
const COUNTDOWN_MS$2 = 2400;
/** 펑! 보여주기 */
const BOOM_MS = 2200;
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
const DONE_MS$10 = 2500;
/** 봇이 폭탄을 받고 넘기기까지 */
const BOT_HOLD_MS = [350, 1500];
//#endregion
//#region src/games/bomb/play/engine.ts
const within$4 = (rng, [min, max]) => min + rng.next() * (max - min);
function createEngine$8(opts) {
	return countdown$1({
		now: opts.now,
		seed: opts.seed,
		players: opts.players,
		teams: opts.teams ?? null,
		alive: opts.players.map(() => true),
		out: [],
		round: 1,
		holder: 0,
		heldSince: 0,
		flight: null,
		phase: {
			kind: "countdown",
			until: 0
		},
		botAt: null,
		passes: opts.players.map(() => 0)
	});
}
function countdown$1(state) {
	return {
		...state,
		flight: null,
		botAt: null,
		phase: {
			kind: "countdown",
			until: state.now + COUNTDOWN_MS$2
		}
	};
}
const aliveIndexes$3 = (state) => state.alive.flatMap((a, i) => a ? [i] : []);
function startPlay(state) {
	const rng = createRng(state.seed);
	const holder = pickOne(rng, aliveIndexes$3(state));
	const explodeAt = state.now + within$4(rng, FUSE_MS);
	return {
		...state,
		seed: rng.seed(),
		holder,
		heldSince: state.now,
		phase: {
			kind: "play",
			start: state.now,
			explodeAt
		}
	};
}
/** 그 사람을 탈락시킨다. 한 명만 남으면 끝 */
function eliminate$1(state, victim) {
	return {
		...state,
		alive: state.alive.map((a, i) => a && i !== victim),
		out: [...state.out, victim]
	};
}
function explode(state) {
	const victim = state.flight ? state.flight.to : state.holder;
	return {
		...eliminate$1(state, victim),
		flight: null,
		botAt: null,
		phase: {
			kind: "boom",
			victim,
			until: state.now + BOOM_MS
		}
	};
}
/** 끝났는지: 한 명 남음, 팀전이면 한 팀만 남음 */
function isOver$3(state) {
	if (aliveIndexes$3(state).length <= 1) return true;
	return !!state.teams && lastTeam(state.alive, state.teams) !== null;
}
/** 이긴 팀 (팀전이고 끝났을 때) */
function winnerTeam$4(state) {
	return state.teams ? lastTeam(state.alive, state.teams) : null;
}
function afterBoom(state) {
	if (isOver$3(state)) return {
		...state,
		phase: {
			kind: "done",
			until: state.now + DONE_MS$10
		}
	};
	return countdown$1({
		...state,
		round: state.round + 1
	});
}
function land(state) {
	const { flight } = state;
	if (!flight || state.now < flight.landAt) return state;
	return {
		...state,
		holder: flight.to,
		heldSince: state.now,
		flight: null
	};
}
function botTurn(state) {
	const { holder } = state;
	if (state.phase.kind !== "play" || state.flight || state.players[holder].kind !== "bot") return state;
	const rng = createRng(state.seed);
	if (state.botAt === null) return {
		...state,
		seed: rng.seed(),
		botAt: state.now + within$4(rng, BOT_HOLD_MS)
	};
	if (state.now < state.botAt) return state;
	const side = neighborsOf(state.alive, holder) ?? [];
	const foes = side.filter((j) => !sameTeam(state.teams, holder, j));
	const to = pickOne(rng, foes.length ? foes : side);
	return pass({
		...state,
		seed: rng.seed()
	}, holder, to);
}
/**
* i 바로 옆에 앉은 살아 있는 사람: [왼쪽, 오른쪽]. 자리 번호가 커지는 쪽이 왼쪽
* (화면에서 나를 맨 아래에 두고 시계 방향으로 앉히므로 다음 번호가 내 왼쪽에 보인다). 둘만 남으면 같은 사람
*/
function neighborsOf(alive, i) {
	const n = alive.length;
	const step = (dir) => {
		for (let k = 1; k < n; k++) {
			const j = (i + dir * k + n) % n;
			if (alive[j]) return j;
		}
		return -1;
	};
	const left = step(1);
	return left < 0 ? null : [left, step(-1)];
}
/** 받은 폭탄을 다시 던질 수 있게 되기까지 남은 시간 */
function holdLeft(state) {
	return Math.max(0, state.heldSince + 200 - state.now);
}
/** 지금 from이 to에게 던질 수 있는지 (받고 MIN_HOLD_MS가 지난 뒤, 바로 옆 사람에게만) */
function canPass(state, from, to) {
	if (state.phase.kind !== "play" || state.flight !== null || state.holder !== from || from === to) return false;
	if (holdLeft(state) > 0) return false;
	return neighborsOf(state.alive, from)?.includes(to) ?? false;
}
function pass(state, from, to) {
	if (!canPass(state, from, to)) return state;
	return {
		...state,
		flight: {
			from,
			to,
			landAt: state.now + 300
		},
		botAt: null,
		passes: state.passes.map((n, i) => i === from ? n + 1 : n)
	};
}
function drop$8(state, player) {
	if (!state.alive[player] || state.phase.kind === "done") return state;
	let next = eliminate$1(state, player);
	const left = aliveIndexes$3(next);
	if (isOver$3(next)) return {
		...next,
		flight: null,
		phase: {
			kind: "done",
			until: state.now + DONE_MS$10
		}
	};
	if (next.holder === player || next.flight?.to === player || next.flight?.from === player) {
		const rng = createRng(next.seed);
		next = {
			...next,
			seed: rng.seed(),
			holder: pickOne(rng, left),
			heldSince: state.now,
			flight: null,
			botAt: null
		};
	}
	return next;
}
function tick$11(state) {
	const { phase, now } = state;
	switch (phase.kind) {
		case "countdown": return now >= phase.until ? startPlay(state) : state;
		case "play":
			if (now >= phase.explodeAt) return explode(state);
			return botTurn(land(state));
		case "boom": return now >= phase.until ? afterBoom(state) : state;
		case "done": return state;
	}
}
function engineReducer$8(state, action) {
	switch (action.type) {
		case "tick": return tick$11({
			...state,
			now: action.now
		});
		case "pass": return pass(state, action.from, action.to);
		case "drop": return drop$8(state, action.player);
	}
}
/** 순위: 1등(끝까지 남은 사람)부터. 끝나기 전이면 남은 사람들은 순서 없이 앞에 */
function rankingOf$1(state) {
	return [...aliveIndexes$3(state), ...[...state.out].reverse()];
}
//#endregion
//#region src/games/bomb/play/view.ts
/** 심판 상태 → 화면 (터지는 시각은 넣지 않는다) */
function toView$6(s) {
	const { phase, now } = s;
	return {
		players: s.players.map(({ id, name, avatar }) => ({
			id,
			name,
			avatar
		})),
		teams: s.teams,
		winner: phase.kind === "done" ? winnerTeam$4(s) : null,
		alive: s.alive,
		holder: s.holder,
		flight: s.flight ? {
			from: s.flight.from,
			to: s.flight.to,
			leftMs: Math.max(0, s.flight.landAt - now)
		} : null,
		holdLeftMs: holdLeft(s),
		phase: phase.kind,
		leftMs: phase.kind === "play" ? 0 : Math.max(0, phase.until - now),
		elapsedMs: phase.kind === "play" ? now - phase.start : 0,
		victim: phase.kind === "boom" ? phase.victim : null,
		round: s.round,
		ranking: rankingOf$1(s)
	};
}
/** 친구에게 바로 알려야 할 만큼 바뀌었는지 (그 밖엔 1초마다 보냄) */
function viewChanged$5(a, b) {
	if (!a) return true;
	return a.phase !== b.phase || a.round !== b.round || a.holder !== b.holder || a.flight === null !== (b.flight === null) || a.flight?.to !== b.flight?.to || a.alive.some((x, i) => x !== b.alive[i]);
}
//#endregion
//#region src/server/referees/bomb.ts
function bombReferee(setup, ctx) {
	const o = setup ?? {};
	const players = readPlayers(o.players, ctx, 2, 8);
	if (!players) return null;
	const teams = readTeams(o.teams, players.length);
	if (teams === void 0) return null;
	return hostEngineReferee(ctx, {
		state: createEngine$8({
			now: ctx.now(),
			seed: serverSeed(),
			players,
			teams
		}),
		reduce: engineReducer$8,
		tick: (now) => ({
			type: "tick",
			now
		}),
		toView: toView$6,
		changed: viewChanged$5,
		input: (s, from, m) => {
			if (m.t !== "pass") return void 0;
			const who = humanIndex(s.players, from);
			const to = s.players.findIndex((p) => p.id === m.to);
			return who >= 0 && to >= 0 ? {
				type: "pass",
				from: who,
				to
			} : null;
		},
		drop: (s, key) => {
			const player = humanIndex(s.players, key);
			return player >= 0 ? {
				type: "drop",
				player
			} : null;
		},
		done: (s) => s.phase.kind === "done",
		nowOf: (s) => s.now
	});
}
//#endregion
//#region src/shared/words/koWords.ts
const WORD_GROUPS = {
	동물: [
		"기린",
		"코끼리",
		"고양이",
		"강아지",
		"토끼",
		"거북이",
		"사자",
		"호랑이",
		"펭귄",
		"돼지",
		"원숭이",
		"뱀",
		"개구리",
		"오리",
		"닭",
		"말",
		"소",
		"양",
		"곰",
		"판다",
		"여우",
		"늑대",
		"다람쥐",
		"고슴도치",
		"하마",
		"악어",
		"얼룩말",
		"낙타",
		"캥거루",
		"부엉이",
		"독수리",
		"앵무새",
		"참새",
		"박쥐",
		"쥐",
		"사슴",
		"물개",
		"고래",
		"상어",
		"문어",
		"오징어",
		"게",
		"새우",
		"달팽이",
		"나비",
		"벌",
		"개미",
		"거미",
		"무당벌레",
		"잠자리"
	],
	음식: [
		"사과",
		"바나나",
		"포도",
		"수박",
		"딸기",
		"복숭아",
		"귤",
		"파인애플",
		"체리",
		"레몬",
		"당근",
		"옥수수",
		"감자",
		"고구마",
		"브로콜리",
		"버섯",
		"김밥",
		"라면",
		"떡볶이",
		"피자",
		"햄버거",
		"치킨",
		"아이스크림",
		"케이크",
		"도넛",
		"빵",
		"우유",
		"계란",
		"치즈",
		"사탕",
		"초콜릿",
		"쿠키",
		"핫도그",
		"만두",
		"주먹밥",
		"팝콘",
		"솜사탕",
		"붕어빵",
		"호떡"
	],
	물건: [
		"우산",
		"안경",
		"모자",
		"신발",
		"양말",
		"가방",
		"시계",
		"연필",
		"지우개",
		"가위",
		"자",
		"책",
		"공책",
		"컵",
		"숟가락",
		"젓가락",
		"포크",
		"칼",
		"냄비",
		"프라이팬",
		"의자",
		"책상",
		"침대",
		"소파",
		"텔레비전",
		"냉장고",
		"선풍기",
		"전화기",
		"컴퓨터",
		"카메라",
		"열쇠",
		"자물쇠",
		"전구",
		"촛불",
		"거울",
		"빗",
		"칫솔",
		"수건",
		"휴지",
		"풍선",
		"선물",
		"편지",
		"왕관",
		"반지",
		"목걸이",
		"망치",
		"사다리",
		"바구니",
		"빗자루",
		"주전자"
	],
	탈것: [
		"자동차",
		"버스",
		"기차",
		"비행기",
		"배",
		"자전거",
		"오토바이",
		"헬리콥터",
		"로켓",
		"트럭",
		"소방차",
		"구급차",
		"경찰차",
		"택시",
		"잠수함",
		"열기구",
		"스케이트보드",
		"유모차",
		"지하철",
		"트랙터"
	],
	자연: [
		"해",
		"달",
		"별",
		"구름",
		"비",
		"눈사람",
		"무지개",
		"번개",
		"산",
		"바다",
		"강",
		"섬",
		"나무",
		"꽃",
		"해바라기",
		"장미",
		"선인장",
		"나뭇잎",
		"불",
		"화산",
		"폭포",
		"파도",
		"돌",
		"모래성",
		"토네이도"
	],
	장소: [
		"집",
		"학교",
		"병원",
		"성",
		"교회",
		"등대",
		"다리",
		"놀이터",
		"수영장",
		"공원",
		"동물원",
		"캠핑",
		"텐트",
		"피라미드",
		"탑",
		"감옥",
		"빌딩",
		"시장",
		"도서관",
		"우체국"
	],
	운동: [
		"축구공",
		"야구공",
		"농구공",
		"배드민턴",
		"볼링",
		"스키",
		"수영",
		"태권도",
		"줄넘기",
		"양궁",
		"골프",
		"탁구",
		"씨름",
		"스케이트",
		"등산",
		"낚시",
		"달리기",
		"권투",
		"요가",
		"서핑"
	],
	사람: [
		"의사",
		"경찰",
		"소방관",
		"요리사",
		"선생님",
		"가수",
		"해적",
		"마법사",
		"공주",
		"왕",
		"로봇",
		"외계인",
		"유령",
		"천사",
		"닌자",
		"산타",
		"광대",
		"우주인",
		"농부",
		"화가"
	]
};
const WORDS = Object.values(WORD_GROUPS).flat();
function groupOf(word) {
	for (const [g, ws] of Object.entries(WORD_GROUPS)) if (ws.includes(word)) return g;
	return null;
}
/** 정답 비교: 띄어쓰기·대소문자 무시 */
const normalizeGuess = (s) => s.replace(/\s+/g, "").toLowerCase();
const CHOSUNG = [
	"ㄱ",
	"ㄲ",
	"ㄴ",
	"ㄷ",
	"ㄸ",
	"ㄹ",
	"ㅁ",
	"ㅂ",
	"ㅃ",
	"ㅅ",
	"ㅆ",
	"ㅇ",
	"ㅈ",
	"ㅉ",
	"ㅊ",
	"ㅋ",
	"ㅌ",
	"ㅍ",
	"ㅎ"
];
const JUNG = [
	"ㅏ",
	"ㅐ",
	"ㅑ",
	"ㅒ",
	"ㅓ",
	"ㅔ",
	"ㅕ",
	"ㅖ",
	"ㅗ",
	"ㅘ",
	"ㅙ",
	"ㅚ",
	"ㅛ",
	"ㅜ",
	"ㅝ",
	"ㅞ",
	"ㅟ",
	"ㅠ",
	"ㅡ",
	"ㅢ",
	"ㅣ"
];
const BASE = 44032;
const END = 55203;
const isSyllable = (ch) => {
	const c = ch.charCodeAt(0);
	return c >= BASE && c <= END;
};
/** 한 글자 → [초성, 중성, 종성] 번호 (한글 글자가 아니면 null) */
function splitSyllable(ch) {
	if (!isSyllable(ch)) return null;
	const n = ch.charCodeAt(0) - BASE;
	return [
		Math.floor(n / 588),
		Math.floor(n % 588 / 28),
		n % 28
	];
}
const joinSyllable = (cho, jung, jong) => String.fromCharCode(BASE + cho * 588 + jung * 28 + jong);
/** 낱말의 초성 ('기린' → 'ㄱㄹ'). 한글이 아닌 글자는 그대로 */
const chosungOf = (word) => [...word].map((ch) => splitSyllable(ch) ? CHOSUNG[splitSyllable(ch)[0]] : ch).join("");
/**
* 두음법칙으로 바꿀 수 있는 첫 글자 (끝말잇기): 'ㄹ' → 'ㄴ'(라→나), 'ㄹ'·'ㄴ' + ㅑㅕㅖㅛㅠㅣ → 'ㅇ'(려→여, 녀→여).
* 원래 글자 포함해서 돌려준다
*/
function initialVariants(ch) {
	const s = splitSyllable(ch);
	if (!s) return [ch];
	const [cho, jung, jong] = s;
	const out = [ch];
	const yVowel = [
		"ㅑ",
		"ㅕ",
		"ㅖ",
		"ㅛ",
		"ㅠ",
		"ㅣ"
	].includes(JUNG[jung]);
	const R = 5;
	const N = 2;
	const O = 11;
	if (cho === R) out.push(joinSyllable(yVowel ? O : N, jung, jong));
	if (cho === N && yVowel) out.push(joinSyllable(O, jung, jong));
	return out;
}
//#endregion
//#region src/games/chosung/constants.ts
const INTRO_MS$7 = 2e3;
/** 한 문제 */
const ASK_MS = 2e4;
const REVEAL_MS$2 = 2500;
const DONE_MS$9 = 2e3;
/** 맞힌 순서대로 (그 뒤 1점). 힌트가 나온 뒤에 맞히면 절반(올림) */
const POINTS = [
	10,
	7,
	5,
	3,
	2
];
//#endregion
//#region src/games/chosung/play/engine.ts
function shuffle$2(rng, xs) {
	const a = [...xs];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rng.next() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}
/** 문제: 갈래를 골고루 섞어서, 두 글자 이상 */
function pickQuestions(rng, n = 10) {
	return shuffle$2(rng, Object.entries(WORD_GROUPS).flatMap(([group, ws]) => ws.filter((w) => [...w].length >= 2).map((word) => ({
		word,
		group
	})))).slice(0, n).map((x) => ({
		...x,
		hintAt: Math.floor(rng.next() * [...x.word].length)
	}));
}
function addLog$2(s, kind, player, text) {
	const seq = s.logSeq + 1;
	return {
		...s,
		logSeq: seq,
		log: [...s.log, {
			seq,
			kind,
			player,
			text
		}].slice(-30)
	};
}
const activePlayers$1 = (s) => s.players.flatMap((_, i) => s.left[i] ? [] : [i]);
function createEngine$7(opts) {
	const rng = createRng(opts.seed);
	return {
		now: opts.now,
		seed: rng.seed(),
		players: opts.players,
		left: opts.players.map(() => false),
		scores: opts.players.map(() => 0),
		questions: pickQuestions(rng),
		q: -1,
		phase: {
			kind: "intro",
			until: opts.now + INTRO_MS$7
		},
		log: [],
		logSeq: 0
	};
}
const hintShown = (s) => s.phase.kind === "ask" && s.now >= s.phase.start + 1e4;
function ask(s) {
	const q = s.q + 1;
	if (q >= s.questions.length || activePlayers$1(s).length === 0) return {
		...s,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$9
		}
	};
	return {
		...s,
		q,
		phase: {
			kind: "ask",
			start: s.now,
			until: s.now + ASK_MS,
			guessed: []
		}
	};
}
function reveal$3(s) {
	if (s.phase.kind !== "ask") return s;
	return addLog$2({
		...s,
		phase: {
			kind: "reveal",
			until: s.now + REVEAL_MS$2,
			guessed: s.phase.guessed
		}
	}, "system", null, `정답: ${s.questions[s.q].word}`);
}
function canGuess$1(s, player) {
	return s.phase.kind === "ask" && !s.left[player] && !s.phase.guessed.some((g) => g.player === player);
}
function guess$1(s, player, text) {
	const p = s.phase;
	if (!canGuess$1(s, player) || p.kind !== "ask") return s;
	const clean = [...text.replace(/[\u0000-\u001f\u007f]/g, "").trim()].slice(0, 20).join("");
	if (!clean) return s;
	if (normalizeGuess(clean) !== normalizeGuess(s.questions[s.q].word)) return addLog$2(s, "chat", player, clean);
	const hinted = hintShown(s);
	const base = POINTS[p.guessed.length] ?? 1;
	const points = hinted ? Math.ceil(base / 2) : base;
	const guessed = [...p.guessed, {
		player,
		points,
		hinted
	}];
	let next = addLog$2({
		...s,
		scores: s.scores.map((v, i) => i === player ? v + points : v),
		phase: {
			...p,
			guessed
		}
	}, "correct", player, `${s.players[player].name}님 정답! +${points}`);
	if (activePlayers$1(next).every((i) => guessed.some((g) => g.player === i))) next = reveal$3(next);
	return next;
}
function drop$7(s, player) {
	if (s.left[player] || s.phase.kind === "done") return s;
	const next = addLog$2({
		...s,
		left: s.left.map((l, i) => l || i === player)
	}, "system", null, `${s.players[player].name}님이 나갔어요`);
	if (activePlayers$1(next).length === 0) return {
		...next,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$9
		}
	};
	const p = next.phase;
	if (p.kind === "ask" && activePlayers$1(next).every((i) => p.guessed.some((g) => g.player === i))) return reveal$3(next);
	return next;
}
function tick$10(s) {
	const { phase, now } = s;
	if (phase.kind === "done" || now < phase.until) return s;
	if (phase.kind === "ask") return reveal$3(s);
	return ask(s);
}
function engineReducer$7(s, a) {
	switch (a.type) {
		case "tick": return tick$10({
			...s,
			now: a.now
		});
		case "guess": return guess$1(s, a.player, a.text);
		case "drop": return drop$7(s, a.player);
	}
}
const ranksOf$5 = (s) => s.scores.map((v) => 1 + s.scores.filter((o) => o > v).length);
//#endregion
//#region src/games/chosung/play/view.ts
function viewFor$1(s, viewerId) {
	const me = s.players.findIndex((p) => p.id === viewerId);
	const p = s.phase;
	const cur = s.q >= 0 ? s.questions[s.q] : null;
	const hint = hintShown(s);
	const iGot = (p.kind === "ask" || p.kind === "reveal") && p.guessed.some((g) => g.player === me);
	let clue = null;
	if (cur && (p.kind === "ask" || p.kind === "reveal")) {
		const cho = [...chosungOf(cur.word)];
		const syl = [...cur.word];
		clue = cho.map((c, i) => hint && i === cur.hintAt ? syl[i] : c).join("");
	}
	return {
		players: s.players.map(({ id, name }) => ({
			id,
			name
		})),
		left: s.left,
		scores: s.scores,
		phase: p.kind,
		leftMs: Math.max(0, p.until - s.now),
		q: Math.max(0, s.q),
		total: s.questions.length,
		clue,
		group: cur && (p.kind === "ask" || p.kind === "reveal") ? cur.group : null,
		hint,
		answer: cur && (p.kind === "reveal" || iGot) ? cur.word : null,
		canGuess: canGuess$1(s, me),
		guessed: p.kind === "ask" || p.kind === "reveal" ? p.guessed : [],
		log: s.log.slice(-15),
		ranks: ranksOf$5(s)
	};
}
function changeKey$2(s) {
	return [
		s.phase.kind,
		s.q,
		s.logSeq,
		s.left.join(),
		hintShown(s)
	].join("|");
}
//#endregion
//#region src/server/referees/chosung.ts
function chosungReferee(setup, ctx) {
	const players = readPlayers((setup ?? {}).players, ctx, 2, 8);
	if (!players || players.some((p) => p.kind === "bot")) return null;
	return hostEngineReferee(ctx, {
		state: createEngine$7({
			now: ctx.now(),
			seed: serverSeed(),
			players
		}),
		reduce: engineReducer$7,
		tick: (now) => ({
			type: "tick",
			now
		}),
		toView: (s) => s,
		changed: (a, b) => !a || changeKey$2(a) !== changeKey$2(b),
		viewFor: (_v, key, s) => viewFor$1(s, key),
		input: (s, from, m) => {
			if (m.t !== "guess") return void 0;
			const player = s.players.findIndex((p) => p.id === from);
			return player >= 0 && typeof m.text === "string" && m.text.length <= 60 ? {
				type: "guess",
				player,
				text: m.text
			} : null;
		},
		drop: (s, key) => {
			const player = s.players.findIndex((p) => p.id === key);
			return player >= 0 ? {
				type: "drop",
				player
			} : null;
		},
		done: (s) => s.phase.kind === "done",
		nowOf: (s) => s.now
	});
}
//#endregion
//#region src/games/doodle/constants.ts
/** 시작 안내 */
const INTRO_MS$6 = 2e3;
/** 그릴 사람이 제시어 2개 중 고르는 시간 (넘으면 무작위) */
const CHOOSE_MS$1 = 6e3;
/** 그리는 시간 */
const DRAW_MS = 6e4;
/** 정답 보여주기 */
const REVEAL_MS$1 = 4e3;
const DONE_MS$8 = 2500;
/** 맞힌 순서대로 점수 (그 뒤는 1점) */
const GUESS_POINTS = [
	10,
	8,
	6,
	5,
	4,
	3,
	2
];
/** 보기로 맞히면 점수 절반 (올림) */
const CHOICE_RATE = .5;
/** 제시어 보여주기 */
const VOTE_WORD_MS = 3e3;
const VOTE_DRAW_MS = 6e4;
const VOTE_PICK_MS = 15e3;
/** 판 결과(누가 그렸는지·표) 보여주기 */
const VOTE_RESULT_MS = 6e3;
//#endregion
//#region src/games/doodle/play/engine.ts
function shuffle$1(rng, xs) {
	const a = [...xs];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rng.next() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}
function addLog$1(s, kind, player, text) {
	const seq = s.logSeq + 1;
	return {
		...s,
		logSeq: seq,
		log: [...s.log, {
			seq,
			kind,
			player,
			text
		}].slice(-40)
	};
}
const activePlayers = (s) => s.players.flatMap((_, i) => s.left[i] ? [] : [i]);
function createEngine$6(opts) {
	const rng = createRng(opts.seed);
	const n = opts.players.length;
	const base = shuffle$1(rng, opts.players.map((_, i) => i));
	const order = n <= 3 ? [...base, ...base] : base;
	return {
		now: opts.now,
		seed: rng.seed(),
		players: opts.players,
		left: opts.players.map(() => false),
		scores: opts.players.map(() => 0),
		order,
		turnNo: -1,
		phase: {
			kind: "intro",
			until: opts.now + INTRO_MS$6
		},
		log: [],
		logSeq: 0,
		used: []
	};
}
/** 다음 차례로 (나간 사람 차례는 건너뜀). 더 없거나 남은 사람이 둘보다 적으면 끝 */
function nextTurn$2(s) {
	if (activePlayers(s).length < 2) return finish$2(s);
	let turnNo = s.turnNo + 1;
	while (turnNo < s.order.length && s.left[s.order[turnNo]]) turnNo++;
	if (turnNo >= s.order.length) return finish$2(s);
	const rng = createRng(s.seed);
	const fresh = WORDS.filter((w) => !s.used.includes(w));
	const pool = shuffle$1(rng, fresh.length >= 2 ? fresh : WORDS);
	const a = pool[0];
	const b = pool.find((w) => groupOf(w) !== groupOf(a)) ?? pool[1];
	const drawer = s.order[turnNo];
	return {
		...s,
		seed: rng.seed(),
		turnNo,
		phase: {
			kind: "choose",
			drawer,
			options: [a, b],
			until: s.now + CHOOSE_MS$1
		}
	};
}
/** 보기 4개: 정답 + 같은 갈래에서 3개 (모자라면 아무거나) */
function choicesFor(rng, word) {
	const group = groupOf(word);
	const same = shuffle$1(rng, (group ? WORD_GROUPS[group] : WORDS).filter((w) => w !== word));
	const others = shuffle$1(rng, WORDS.filter((w) => w !== word && !same.includes(w)));
	return shuffle$1(rng, [word, ...[...same, ...others].slice(0, 3)]);
}
function startDraw(s, index) {
	if (s.phase.kind !== "choose") return s;
	const { drawer, options } = s.phase;
	const word = options[index === 1 ? 1 : 0];
	const rng = createRng(s.seed);
	const choices = choicesFor(rng, word);
	return addLog$1({
		...s,
		seed: rng.seed(),
		used: [...s.used, word],
		phase: {
			kind: "draw",
			drawer,
			word,
			start: s.now,
			until: s.now + DRAW_MS,
			choices,
			guessed: [],
			choiceTried: []
		}
	}, "system", drawer, `${s.players[drawer].name}님이 그려요`);
}
function reveal$2(s) {
	if (s.phase.kind !== "draw") return s;
	const { drawer, word, guessed } = s.phase;
	return addLog$1({
		...s,
		phase: {
			kind: "reveal",
			drawer,
			word,
			until: s.now + REVEAL_MS$1,
			guessed
		}
	}, "system", null, `정답은 '${word}'`);
}
function finish$2(s) {
	return {
		...s,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$8
		}
	};
}
/** 보기가 보이는지 (마지막 20초) */
const choicesOpen = (s) => s.phase.kind === "draw" && s.now >= s.phase.start + 4e4;
/** 맞힘: 순서대로 점수, 보기로 맞히면 절반. 그린 사람은 1명당 점수. 모두 맞히면 바로 정답 보여주기 */
function correct(s, player, viaChoice) {
	const phase = s.phase;
	if (phase.kind !== "draw") return s;
	const base = GUESS_POINTS[phase.guessed.length] ?? 1;
	const points = viaChoice ? Math.ceil(base * CHOICE_RATE) : base;
	const guessed = [...phase.guessed, {
		player,
		points,
		viaChoice
	}];
	const scores = s.scores.map((v, i) => i === player ? v + points : i === phase.drawer ? v + 3 : v);
	let next = addLog$1({
		...s,
		scores,
		phase: {
			...phase,
			guessed
		}
	}, "correct", player, `${s.players[player].name}님 정답!${viaChoice ? " (보기)" : ""}`);
	if (activePlayers(next).filter((i) => i !== phase.drawer && !guessed.some((g) => g.player === i)).length === 0) next = reveal$2(next);
	return next;
}
/** 맞힐 수 있는 사람인지 (그리는 중, 그린 사람 아님, 아직 못 맞힘, 안 나감) */
function canGuess(s, player) {
	return s.phase.kind === "draw" && player !== s.phase.drawer && !s.left[player] && !s.phase.guessed.some((g) => g.player === player);
}
function guess(s, player, text) {
	if (!canGuess(s, player) || s.phase.kind !== "draw") return s;
	const clean = [...text.replace(/[\u0000-\u001f\u007f]/g, "").trim()].slice(0, 30).join("");
	if (!clean) return s;
	if (normalizeGuess(clean) === normalizeGuess(s.phase.word)) return correct(s, player, false);
	return addLog$1(s, "chat", player, clean);
}
function pick$2(s, player, index) {
	if (!canGuess(s, player) || s.phase.kind !== "draw" || !choicesOpen(s) || s.phase.choiceTried.includes(player)) return s;
	const chosen = s.phase.choices[index];
	if (chosen === void 0) return s;
	if (chosen === s.phase.word) return correct(s, player, true);
	return {
		...s,
		phase: {
			...s.phase,
			choiceTried: [...s.phase.choiceTried, player]
		}
	};
}
function drop$6(s, player) {
	if (s.left[player] || s.phase.kind === "done") return s;
	let next = addLog$1({
		...s,
		left: s.left.map((l, i) => l || i === player)
	}, "system", null, `${s.players[player].name}님이 나갔어요`);
	if (activePlayers(next).length < 2) return finish$2(next);
	const p = next.phase;
	if ((p.kind === "choose" || p.kind === "draw") && p.drawer === player) return p.kind === "draw" ? reveal$2(next) : nextTurn$2(next);
	if (p.kind === "draw") {
		if (activePlayers(next).filter((i) => i !== p.drawer && !p.guessed.some((g) => g.player === i)).length === 0) next = reveal$2(next);
	}
	return next;
}
function tick$9(s) {
	const { phase, now } = s;
	switch (phase.kind) {
		case "intro": return now >= phase.until ? nextTurn$2(s) : s;
		case "choose": {
			if (now < phase.until) return s;
			const rng = createRng(s.seed);
			return startDraw({
				...s,
				seed: rng.seed()
			}, rng.next() < .5 ? 0 : 1);
		}
		case "draw": return now >= phase.until ? reveal$2(s) : s;
		case "reveal": return now >= phase.until ? nextTurn$2(s) : s;
		case "done": return s;
	}
}
function engineReducer$6(s, a) {
	switch (a.type) {
		case "tick": return tick$9({
			...s,
			now: a.now
		});
		case "choose": return s.phase.kind === "choose" && s.phase.drawer === a.player ? startDraw(s, a.index) : s;
		case "guess": return guess(s, a.player, a.text);
		case "pick": return pick$2(s, a.player, a.index);
		case "drop": return drop$6(s, a.player);
	}
}
/** 순위 (점수 높은 순, 같으면 같은 등수) */
function ranksOf$4(s) {
	return s.scores.map((v) => 1 + s.scores.filter((o) => o > v).length);
}
//#endregion
//#region src/games/doodle/play/ink.ts
/** 한 판에 쌓는 점 수 제한 (너무 크면 받는 폰이 느려짐) */
const MAX_POINTS = 4e4;
/** 한 판 채우기 횟수 제한 (다시 그릴 때마다 채우기를 다시 해서) */
const MAX_FILLS = 60;
function applyOps(strokes, ops) {
	let out = strokes;
	for (const o of ops) if (o.op === "x") out = [];
	else if (o.op === "u") out = out.slice(0, -1);
	else if (o.op === "s") out = [...out, {
		id: o.id,
		c: o.c,
		w: o.w,
		p: o.p,
		...o.k && o.k !== "p" ? { k: o.k } : {}
	}];
	else if (o.op === "a") {
		const i = out.findIndex((s) => s.id === o.id && (s.k ?? "p") === "p");
		if (i >= 0) out = out.map((s, k) => k === i ? {
			...s,
			p: [...s.p, ...o.p]
		} : s);
	}
	return out;
}
const pointCount = (strokes) => strokes.reduce((n, s) => n + s.p.length / 2, 0);
/** 종류마다 점 개수: 도형은 정확히 두 점, 채우기는 한 점 */
const POINTS_OF = {
	p: (n) => n >= 2,
	l: (n) => n === 4,
	r: (n) => n === 4,
	e: (n) => n === 4,
	f: (n) => n === 2
};
/** 받은 묶음 검사 (그리는 사람이 보낸 것만 쓰지만 모양도 확인). 이상하면 null */
function readOps(x) {
	if (!Array.isArray(x) || x.length > 200) return null;
	const pts = (p) => Array.isArray(p) && p.length <= 400 && p.length % 2 === 0 && p.every((v, i) => Number.isInteger(v) && v >= 0 && v <= (i % 2 ? 750 : 1e3));
	const out = [];
	for (const o of x) {
		if (!o || typeof o !== "object") return null;
		if (o.op === "x" || o.op === "u") out.push({ op: o.op });
		else if (o.op === "s" && Number.isInteger(o.id) && typeof o.c === "string" && /^#[0-9a-f]{6}$/.test(o.c) && typeof o.w === "number" && o.w > 0 && o.w <= 40 && pts(o.p)) {
			const k = o.k ?? "p";
			if (!(k in POINTS_OF) || !POINTS_OF[k](o.p.length)) return null;
			out.push({
				op: "s",
				id: o.id,
				c: o.c,
				w: o.w,
				p: o.p,
				...k !== "p" ? { k } : {}
			});
		} else if (o.op === "a" && Number.isInteger(o.id) && pts(o.p)) out.push({
			op: "a",
			id: o.id,
			p: o.p
		});
		else return null;
	}
	return out;
}
const tooBig = (strokes) => pointCount(strokes) > MAX_POINTS || strokes.filter((s) => s.k === "f").length > MAX_FILLS;
//#endregion
//#region src/games/doodle/play/view.ts
function viewFor(s, viewerId) {
	const me = s.players.findIndex((p) => p.id === viewerId);
	const p = s.phase;
	const drawer = p.kind === "choose" || p.kind === "draw" || p.kind === "reveal" ? p.drawer : null;
	const word = p.kind === "reveal" ? p.word : p.kind === "draw" && drawer === me ? p.word : null;
	const showChoices = p.kind === "draw" && choicesOpen(s) && canGuess(s, me);
	return {
		players: s.players.map(({ id, name, avatar }) => ({
			id,
			name,
			avatar
		})),
		left: s.left,
		scores: s.scores,
		phase: p.kind,
		leftMs: "until" in p ? Math.max(0, p.until - s.now) : 0,
		turnNo: Math.max(0, s.turnNo),
		turns: s.order.length,
		drawer,
		word,
		wordLength: p.kind === "draw" ? [...p.word].length : null,
		options: p.kind === "choose" && drawer === me ? p.options : null,
		choices: showChoices ? p.choices : null,
		choiceTried: p.kind === "draw" && p.choiceTried.includes(me),
		canGuess: canGuess(s, me),
		guessed: p.kind === "draw" || p.kind === "reveal" ? p.guessed : [],
		log: s.log.slice(-20),
		ranks: ranksOf$4(s)
	};
}
/** 바로 보내야 할 만큼 바뀌었는지 (그 밖엔 1초마다) */
function changeKey$1(s) {
	const p = s.phase;
	return [
		p.kind,
		s.turnNo,
		s.logSeq,
		s.left.join(),
		p.kind === "draw" ? `${p.guessed.length}.${p.choiceTried.length}.${choicesOpen(s)}` : ""
	].join("|");
}
//#endregion
//#region src/games/doodle/play/voteEngine.ts
function shuffle(rng, xs) {
	const a = [...xs];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rng.next() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}
const activeOf = (s) => s.players.flatMap((_, i) => s.left[i] ? [] : [i]);
function createVote(opts) {
	return {
		now: opts.now,
		seed: opts.seed,
		players: opts.players,
		left: opts.players.map(() => false),
		scores: opts.players.map(() => 0),
		round: 0,
		phase: {
			kind: "intro",
			until: opts.now + INTRO_MS$6
		},
		used: [],
		history: [],
		logSeq: 0
	};
}
function nextRound(s) {
	if (s.round >= 3 || activeOf(s).length < 2) return {
		...s,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$8
		}
	};
	const rng = createRng(s.seed);
	const pool = WORDS.filter((w) => !s.used.includes(w));
	const word = pool[Math.floor(rng.next() * pool.length)];
	return {
		...s,
		seed: rng.seed(),
		round: s.round + 1,
		used: [...s.used, word],
		phase: {
			kind: "word",
			word,
			until: s.now + VOTE_WORD_MS
		}
	};
}
function startVote(s) {
	if (s.phase.kind !== "draw") return s;
	const rng = createRng(s.seed);
	const order = shuffle(rng, activeOf(s));
	return {
		...s,
		seed: rng.seed(),
		phase: {
			kind: "vote",
			word: s.phase.word,
			order,
			votes: s.players.map(() => null),
			until: s.now + VOTE_PICK_MS
		}
	};
}
function finishVote(s) {
	if (s.phase.kind !== "vote") return s;
	const { word, order, votes } = s.phase;
	const got = s.players.map((_, i) => votes.filter((v) => v === i).length);
	const scores = s.scores.map((v, i) => v + got[i] * 3);
	return {
		...s,
		scores,
		history: [...s.history, {
			word,
			got
		}].slice(-40),
		phase: {
			kind: "result",
			word,
			order,
			votes,
			until: s.now + VOTE_RESULT_MS
		}
	};
}
/** 표를 낼 수 있는 사람이 다 냈는지 */
function allVoted(s) {
	if (s.phase.kind !== "vote") return false;
	const { votes, order } = s.phase;
	return activeOf(s).every((i) => votes[i] !== null || order.every((o) => o === i));
}
function vote(s, player, target) {
	const p = s.phase;
	if (p.kind !== "vote" || s.left[player] || player === target || !p.order.includes(target) || p.votes[player] !== null) return s;
	const next = {
		...s,
		phase: {
			...p,
			votes: p.votes.map((v, i) => i === player ? target : v)
		}
	};
	return allVoted(next) ? finishVote(next) : next;
}
function drop$5(s, player) {
	if (s.left[player] || s.phase.kind === "done") return s;
	const next = {
		...s,
		left: s.left.map((l, i) => l || i === player)
	};
	if (activeOf(next).length < 2) return {
		...next,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$8
		}
	};
	return allVoted(next) ? finishVote(next) : next;
}
function tick$8(s) {
	const { phase, now } = s;
	if (phase.kind === "done" || now < phase.until) return s;
	switch (phase.kind) {
		case "intro": return nextRound(s);
		case "word": return {
			...s,
			phase: {
				kind: "draw",
				word: phase.word,
				until: now + VOTE_DRAW_MS
			}
		};
		case "draw": return startVote(s);
		case "vote": return finishVote(s);
		case "result": return nextRound(s);
	}
}
function voteReducer(s, a) {
	switch (a.type) {
		case "tick": return tick$8({
			...s,
			now: a.now
		});
		case "vote": return vote(s, a.player, a.target);
		case "drop": return drop$5(s, a.player);
	}
}
const voteRanks = (s) => s.scores.map((v) => 1 + s.scores.filter((o) => o > v).length);
function voteViewFor(s, viewerId) {
	const me = s.players.findIndex((p) => p.id === viewerId);
	const p = s.phase;
	let gallery = null;
	let myVote = null;
	if (p.kind === "vote" || p.kind === "result") {
		const reveal = p.kind === "result";
		gallery = p.order.map((owner) => ({
			mine: owner === me,
			owner: reveal ? owner : null,
			votes: reveal ? p.votes.filter((v) => v === owner).length : null
		}));
		const mv = p.votes[me];
		myVote = mv === null || mv === void 0 ? null : p.order.indexOf(mv);
	}
	return {
		players: s.players.map(({ id, name }) => ({
			id,
			name
		})),
		left: s.left,
		scores: s.scores,
		round: s.round,
		rounds: 3,
		phase: p.kind,
		leftMs: Math.max(0, p.until - s.now),
		word: p.kind === "intro" || p.kind === "done" ? null : p.word,
		gallery,
		myVote,
		ranks: voteRanks(s),
		history: s.history
	};
}
function voteChangeKey(s) {
	const p = s.phase;
	return [
		p.kind,
		s.round,
		s.left.join(),
		p.kind === "vote" ? p.votes.join() : ""
	].join("|");
}
//#endregion
//#region src/server/referees/doodle.ts
function doodleReferee(setup, ctx) {
	const o = setup ?? {};
	const players = readPlayers(o.players, ctx, 2, 8);
	if (!players || players.some((p) => p.kind === "bot")) return null;
	if (o.mode === "vote") return players.length >= 3 ? voteReferee(players, ctx) : null;
	let strokes = [];
	let inkTurn = -1;
	/** 그림 묶음을 그대로 기억 (다시 보낼 때 그대로) */
	let history = [];
	const drawerKey = (s) => s.phase.kind === "draw" ? s.players[s.phase.drawer].id : null;
	return hostEngineReferee(ctx, {
		state: createEngine$6({
			now: ctx.now(),
			seed: serverSeed(),
			players
		}),
		reduce: engineReducer$6,
		tick: (now) => ({
			type: "tick",
			now
		}),
		toView: (s) => s,
		changed: (a, b) => !a || changeKey$1(a) !== changeKey$1(b),
		viewFor: (_v, key, s) => viewFor(s, key),
		input: (s, from, m) => {
			if (inkTurn !== s.turnNo) {
				inkTurn = s.turnNo;
				strokes = [];
				history = [];
			}
			if (m.t === "ink") {
				const ops = readOps(m.ops);
				if (from !== drawerKey(s) || m.turn !== s.turnNo || !ops) return null;
				const next = applyOps(strokes, ops);
				if (tooBig(next)) return null;
				strokes = next;
				history = ops.some((x) => x.op === "x") ? ops.slice(ops.map((x) => x.op).lastIndexOf("x")) : [...history, ...ops];
				return;
			}
			if (m.t === "inkSync") {
				ctx.sendTo(from, {
					t: "inkAll",
					turn: s.turnNo,
					ops: history
				});
				return null;
			}
			if (m.t !== "choose" && m.t !== "guess" && m.t !== "pick") return void 0;
			const player = s.players.findIndex((p) => p.id === from);
			if (player < 0) return null;
			if (m.t === "guess") return typeof m.text === "string" && m.text.length <= 100 ? {
				type: "guess",
				player,
				text: m.text
			} : null;
			return isInt(m.index, 0, 3) ? {
				type: m.t,
				player,
				index: m.index
			} : null;
		},
		drop: (s, key) => {
			const player = s.players.findIndex((p) => p.id === key);
			return player >= 0 ? {
				type: "drop",
				player
			} : null;
		},
		done: (s) => s.phase.kind === "done",
		nowOf: (s) => s.now
	});
}
/**
* '다 같이 그리기'(투표) 서버 심판: 그리는 동안 각자 그림은 서버에만 모으고(남에게 안 넘김 — 베끼기 막기),
* 투표 단계에 섞은 순서로 모두에게 보낸다(누가 그렸는지는 결과 때 공개). 투표는 서버가 붙인 접속 번호로.
*/
function voteReferee(players, ctx) {
	const drawings = /* @__PURE__ */ new Map();
	let round = 0;
	let sentGallery = -1;
	const galleryOf = (s) => s.phase.kind === "vote" || s.phase.kind === "result" ? s.phase.order.map((i) => drawings.get(s.players[i].id)?.ops ?? []) : null;
	return hostEngineReferee(ctx, {
		state: createVote({
			now: ctx.now(),
			seed: serverSeed(),
			players
		}),
		reduce: (s, a) => {
			const next = voteReducer(s, a);
			if (next.round !== round) {
				round = next.round;
				drawings.clear();
			}
			if (next.phase.kind === "vote" && sentGallery !== next.round) {
				sentGallery = next.round;
				ctx.broadcast({
					t: "gallery",
					round: next.round,
					drawings: galleryOf(next)
				});
			}
			return next;
		},
		tick: (now) => ({
			type: "tick",
			now
		}),
		toView: (s) => s,
		changed: (a, b) => !a || voteChangeKey(a) !== voteChangeKey(b),
		viewFor: (_v, key, s) => voteViewFor(s, key),
		wrap: (v) => ({
			t: "vview",
			v
		}),
		input: (s, from, m) => {
			const player = s.players.findIndex((p) => p.id === from);
			if (m.t === "ink") {
				const ops = readOps(m.ops);
				if (player < 0 || s.phase.kind !== "draw" || m.turn !== s.round || !ops) return null;
				const d = drawings.get(from) ?? {
					strokes: [],
					ops: []
				};
				const strokes = applyOps(d.strokes, ops);
				if (tooBig(strokes)) return null;
				const all = [...d.ops, ...ops];
				const cut = all.map((x) => x.op).lastIndexOf("x");
				drawings.set(from, {
					strokes,
					ops: cut >= 0 ? all.slice(cut) : all
				});
				return null;
			}
			if (m.t === "inkSync") {
				if (s.phase.kind === "draw") ctx.sendTo(from, {
					t: "inkAll",
					turn: s.round,
					ops: drawings.get(from)?.ops ?? []
				});
				else if (s.phase.kind === "vote" || s.phase.kind === "result") ctx.sendTo(from, {
					t: "gallery",
					round: s.round,
					drawings: galleryOf(s)
				});
				return null;
			}
			if (m.t !== "vote") return void 0;
			if (player < 0 || s.phase.kind !== "vote" || !isInt(m.index, 0, 15)) return null;
			const target = s.phase.order[m.index];
			return target === void 0 ? null : {
				type: "vote",
				player,
				target
			};
		},
		drop: (s, key) => {
			const player = s.players.findIndex((p) => p.id === key);
			return player >= 0 ? {
				type: "drop",
				player
			} : null;
		},
		done: (s) => s.phase.kind === "done",
		nowOf: (s) => s.now
	});
}
//#endregion
//#region src/games/fight/constants.ts
/** 자세를 고르는 시간 */
const CHOOSE_MS = 2e3;
/** 공개한 결과를 보여주는 시간 */
const REVEAL_MS = 1200;
/** 첫 턴 전 '시작!' 표시 */
const INTRO_MS$5 = 1200;
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
const DONE_MS$7 = 1800;
//#endregion
//#region src/games/fight/rules/turn.ts
const STANCES = [
	"ready",
	"guard",
	"attack",
	"smash"
];
/** 자세마다 쓰는 스택 */
const STANCE_COST = {
	ready: 0,
	guard: 0,
	attack: 1,
	smash: 3
};
const FRESH = {
	life: 3,
	stacks: 0
};
/** 생명력이 깎이는 일 */
const HURT_EVENTS = [
	"hurt",
	"pierced",
	"overpowered"
];
function isHurt(event) {
	return HURT_EVENTS.includes(event);
}
function canChoose(fighter, stance) {
	return fighter.stacks >= STANCE_COST[stance];
}
/** 고를 수 없는 자세(스택이 모자란 공격)는 준비로 바꾼다 */
function sanitize(fighter, stance) {
	return canChoose(fighter, stance) ? stance : "ready";
}
function eventOf(mine, theirs, me) {
	if (mine === "smash") return theirs === "smash" ? "clash" : "smash-hit";
	if (mine === "attack") {
		if (theirs === "smash") return "overpowered";
		if (theirs === "attack") return "clash";
		return theirs === "guard" ? "blocked" : "strike";
	}
	if (mine === "guard") {
		if (theirs === "smash") return "pierced";
		return theirs === "attack" ? "block" : "guard";
	}
	if (theirs === "attack" || theirs === "smash") return "hurt";
	return me.stacks >= 3 ? "charge-full" : "charge";
}
function apply(f, stance, event) {
	const gained = event === "charge" ? 1 : 0;
	return {
		life: Math.max(0, f.life - (isHurt(event) ? 1 : 0)),
		stacks: f.stacks - STANCE_COST[stance] + gained
	};
}
function resolveTurn(fighters, chosen) {
	const stances = [sanitize(fighters[0], chosen[0]), sanitize(fighters[1], chosen[1])];
	const events = [eventOf(stances[0], stances[1], fighters[0]), eventOf(stances[1], stances[0], fighters[1])];
	return {
		stances,
		events,
		fighters: [apply(fighters[0], stances[0], events[0]), apply(fighters[1], stances[1], events[1])]
	};
}
/** turnsPlayed: 지금까지 끝난 턴 수 */
function winnerOf(fighters, turnsPlayed) {
	const [a, b] = fighters;
	if (a.life <= 0 && b.life <= 0) return "draw";
	if (b.life <= 0) return 0;
	if (a.life <= 0) return 1;
	if (turnsPlayed < 30) return null;
	if (a.life === b.life) return "draw";
	return a.life > b.life ? 0 : 1;
}
//#endregion
//#region src/games/fight/bot/fightBot.ts
const w = (ready, guard, attack, smash = 0) => ({
	ready,
	guard,
	attack,
	smash
});
/** 일반: 내 스택만 보고 대충 고른다. 꽉 차면 강타를 자주 */
function normalWeights(self) {
	if (self.stacks === 0) return w(70, 30, 0);
	if (self.stacks < 3) return w(40, 25, 35);
	return w(0, 15, 25, 60);
}
/** 어려움: 상대 스택과 상대가 고른 자세의 흐름을 읽는다 */
function hardWeights(self, foe, foeHistory) {
	const full = self.stacks >= 3;
	let weights;
	if (foe.stacks === 0) {
		if (self.stacks === 0) weights = w(100, 0, 0);
		else if (!full) weights = w(45, 0, 55);
		else weights = w(0, 0, 25, 75);
	} else if (foe.stacks >= 3) {
		if (full) weights = w(0, 10, 10, 80);
		else if (self.stacks > 0) weights = w(30, 30, 40);
		else weights = w(50, 50, 0);
	} else if (self.stacks === 0) weights = w(50, 50, 0);
	else if (!full) weights = w(25, 40, 35);
	else weights = w(0, 20, 10, 70);
	const [last, before] = [foeHistory.at(-1), foeHistory.at(-2)];
	if (last && last === before) {
		if (last === "ready" && self.stacks > 0) weights = {
			...weights,
			attack: weights.attack + 40
		};
		if (last === "guard") weights = full ? {
			...weights,
			smash: weights.smash + 40
		} : {
			...weights,
			ready: weights.ready + 40
		};
		if (last === "attack") weights = {
			...weights,
			guard: weights.guard + 40
		};
	}
	return weights;
}
function chooseBotStance(opts) {
	const { rng, difficulty, self, foe, foeHistory } = opts;
	return sanitize(self, pickWeighted(rng, difficulty === "hard" ? hardWeights(self, foe, foeHistory) : normalWeights(self)));
}
function withSounds$1(state, ...names) {
	let seq = state.soundSeq;
	const added = names.map((name) => ({
		id: ++seq,
		name
	}));
	return {
		...state,
		sounds: [...state.sounds, ...added].slice(-8),
		soundSeq: seq
	};
}
function createMatch$1(opts) {
	return {
		now: opts.now,
		seed: opts.seed,
		difficulty: opts.difficulty,
		controllers: opts.controllers ?? ["user", "bot"],
		follow: opts.follow ?? false,
		fighters: [FRESH, FRESH],
		turns: [],
		phase: {
			kind: "intro",
			until: opts.now + INTRO_MS$5
		},
		sounds: [],
		soundSeq: 0
	};
}
/** 새 턴: 봇은 이때 몰래 고른다 */
function startChoosing(state) {
	const rng = createRng(state.seed);
	const picks = [null, null];
	state.controllers.forEach((c, i) => {
		if (c !== "bot") return;
		const side = i;
		const other = 1 - side;
		picks[side] = chooseBotStance({
			rng,
			difficulty: state.difficulty,
			self: state.fighters[side],
			foe: state.fighters[other],
			foeHistory: state.turns.map((t) => t.stances[other])
		});
	});
	const inputUntil = state.now + CHOOSE_MS;
	const waitRemote = !state.follow && state.controllers.includes("remote");
	return {
		...state,
		seed: rng.seed(),
		phase: {
			kind: "choosing",
			index: state.turns.length,
			inputUntil,
			until: inputUntil + (waitRemote ? 300 : 0),
			picks
		}
	};
}
function turnSounds(result) {
	const e = result.events;
	if (e.includes("smash-hit")) return ["smash"];
	if (e.includes("strike")) return ["hit"];
	if (e.includes("clash")) return ["clash"];
	if (e.includes("block")) return ["block"];
	if (e.includes("charge")) return ["charge"];
	return ["guard"];
}
function reveal$1(state, picks) {
	const chosen = [picks[0] ?? "ready", picks[1] ?? "ready"];
	const result = resolveTurn(state.fighters, chosen);
	return withSounds$1({
		...state,
		fighters: result.fighters,
		turns: [...state.turns, result],
		phase: {
			kind: "reveal",
			result,
			until: state.now + REVEAL_MS
		}
	}, ...turnSounds(result));
}
function tick$7(state) {
	const { phase, now } = state;
	switch (phase.kind) {
		case "intro": return now >= phase.until && !state.follow ? startChoosing(state) : state;
		case "choosing": return now >= phase.until && !state.follow ? reveal$1(state, phase.picks) : state;
		case "reveal": {
			if (now < phase.until) return state;
			const winner = winnerOf(state.fighters, state.turns.length);
			if (winner === null) return state.follow ? state : startChoosing(state);
			const userSide = state.controllers.indexOf("user");
			return withSounds$1({
				...state,
				phase: {
					kind: "done",
					winner,
					until: now + DONE_MS$7
				}
			}, winner === userSide ? "win" : "lose");
		}
		case "done": return state;
	}
}
function pick$1(state, side, stance) {
	const { phase } = state;
	if (phase.kind !== "choosing" || state.controllers[side] !== "user" || state.now >= phase.inputUntil) return state;
	if (!canChoose(state.fighters[side], stance) || phase.picks[side] === stance) return state;
	return withSounds$1({
		...state,
		phase: {
			...phase,
			picks: withPick(phase.picks, side, stance)
		}
	}, "tick");
}
function withPick(picks, side, stance) {
	return side === 0 ? [stance, picks[1]] : [picks[0], stance];
}
function remotePick(state, side, turn, stance) {
	const { phase } = state;
	if (phase.kind !== "choosing" || phase.index !== turn || state.controllers[side] !== "remote") return state;
	if (!canChoose(state.fighters[side], stance)) return state;
	return {
		...state,
		phase: {
			...phase,
			picks: withPick(phase.picks, side, stance)
		}
	};
}
/** 지금 이 턴을 받을 수 있는지 (친구 쪽, 아직 경기 중) */
function awaitingTurn(state, turn) {
	const { kind } = state.phase;
	return state.follow && turn === state.turns.length && (kind === "intro" || kind === "reveal");
}
function remoteTurn(state, turn) {
	if (!awaitingTurn(state, turn) || winnerOf(state.fighters, state.turns.length) !== null) return state;
	return startChoosing(state);
}
function remoteReveal(state, turn, stances) {
	if (!state.follow || turn !== state.turns.length) return state;
	const { kind } = state.phase;
	if (kind !== "choosing" && kind !== "intro" && kind !== "reveal") return state;
	return reveal$1(state, stances);
}
function matchReducer$1(state, action) {
	switch (action.type) {
		case "tick": return tick$7({
			...state,
			now: action.now
		});
		case "pick": return pick$1(state, action.side, action.stance);
		case "remotePick": return remotePick(state, action.side, action.turn, action.stance);
		case "remoteTurn": return remoteTurn(state, action.turn);
		case "remoteReveal": return remoteReveal(state, action.turn, action.stances);
	}
}
//#endregion
//#region src/server/referees/fight.ts
function fightReferee(_setup, ctx) {
	const members = ctx.members();
	const host = members.find((m) => m.role === "host");
	const guest = members.find((m) => m.role === "guest");
	if (!host || !guest) return null;
	let s = createMatch$1({
		now: ctx.now(),
		seed: serverSeed(),
		difficulty: "normal",
		controllers: ["remote", "remote"]
	});
	let doneAt = null;
	const flush = (prev) => {
		if (s.turns.length > prev.turns.length) {
			const t = s.turns.at(-1);
			ctx.broadcast({
				t: "reveal",
				turn: s.turns.length - 1,
				host: t.stances[0],
				guest: t.stances[1]
			});
		}
		const p = s.phase;
		if (p.kind === "choosing" && (prev.phase.kind !== "choosing" || prev.phase.index !== p.index)) ctx.broadcast({
			t: "turn",
			turn: p.index
		});
		if (doneAt === null && p.kind === "done") doneAt = s.now;
	};
	return {
		input(from, msg) {
			const m = msg ?? {};
			if (m.t === "turn" || m.t === "reveal") return true;
			if (m.t !== "pick") return false;
			const side = from === host.id ? 0 : from === guest.id ? 1 : null;
			if (side === null || typeof m.turn !== "number" || !STANCES.includes(m.stance)) return true;
			const prev = s;
			s = matchReducer$1(s, {
				type: "remotePick",
				side,
				turn: m.turn,
				stance: m.stance
			});
			flush(prev);
			return true;
		},
		tick(now) {
			const prev = s;
			s = matchReducer$1(s, {
				type: "tick",
				now: Math.max(now, s.now)
			});
			flush(prev);
		},
		leave() {},
		finished: () => doneAt !== null && s.now - doneAt > 5e3
	};
}
//#endregion
//#region src/games/memory/bot/memoryBot.ts
/** 열 수 있는 카드 중 기억에 없는 것을 우선, 없으면 아무거나 */
function unknownOrAny(rng, view, exclude) {
	const open = view.available.flatMap((ok, i) => ok && i !== exclude ? [i] : []);
	const unknown = open.filter((i) => view.memory[i] === null);
	return pickOne(rng, unknown.length > 0 ? unknown : open);
}
function chooseBotCard(rng, view) {
	const known = (i) => view.available[i] && view.memory[i] !== null;
	if (view.first) {
		const { index, face } = view.first;
		const pair = view.memory.findIndex((f, i) => i !== index && known(i) && f === face);
		return pair >= 0 ? pair : unknownOrAny(rng, view, index);
	}
	const seen = /* @__PURE__ */ new Map();
	for (let i = 0; i < view.memory.length; i++) {
		if (!known(i)) continue;
		const f = view.memory[i];
		if (seen.has(f)) return seen.get(f);
		seen.set(f, i);
	}
	return unknownOrAny(rng, view, null);
}
//#endregion
//#region src/games/memory/constants.ts
/** 한 장 고르는 시간. 넘기면 무작위로 열린다 */
const PICK_MS$1 = 1e4;
/** 첫 차례 전 '시작!' 표시 */
const INTRO_MS$4 = 1500;
/** 틀린 두 장을 보여주는 시간 (그다음 덮고 차례가 넘어간다) */
const MISS_SHOW_MS = 1e3;
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
const DONE_MS$6 = 1800;
/** 봇 기억력: 열린 카드를 기억할 확률, 차례가 바뀔 때 기억한 카드 하나를 잊을 확률 */
const BOT_MEMORY = {
	normal: {
		remember: .5,
		forget: .2
	},
	hard: {
		remember: .9,
		forget: .03
	}
};
//#endregion
//#region src/games/memory/play/matchState.ts
/** 시드로 덱을 섞는다. 친구 대전은 둘이 같은 시드를 써서 같은 덱이 된다 */
function shuffleDeck(seed) {
	const rng = createRng(seed);
	const faces = Array.from({ length: 22 }, (_, i) => i % 11);
	for (let i = faces.length - 1; i > 0; i--) {
		const j = Math.floor(rng.next() * (i + 1));
		[faces[i], faces[j]] = [faces[j], faces[i]];
	}
	return faces;
}
function withSounds(state, ...names) {
	let seq = state.soundSeq;
	const added = names.map((name) => ({
		id: ++seq,
		name
	}));
	return {
		...state,
		sounds: [...state.sounds, ...added].slice(-8),
		soundSeq: seq
	};
}
function createMatch(opts) {
	const rng = createRng(opts.seed);
	const deckSeed = opts.deckSeed ?? Math.floor(rng.next() * 2 ** 32);
	const first = opts.first ?? (rng.next() < .5 ? 0 : 1);
	return {
		now: opts.now,
		seed: rng.seed(),
		difficulty: opts.difficulty,
		controllers: opts.controllers ?? ["user", "bot"],
		cards: shuffleDeck(deckSeed).map((face) => ({
			face: opts.hidden ? -1 : face,
			owner: null
		})),
		turn: first,
		open: [],
		flips: [],
		memory: Array.from({ length: 22 }, () => null),
		phase: {
			kind: "intro",
			until: opts.now + INTRO_MS$4
		},
		sounds: [],
		soundSeq: 0,
		hidden: !!opts.hidden
	};
}
/** 지금 열 수 있는 카드인지 */
function canFlip(state, index) {
	const card = state.cards[index];
	return state.phase.kind === "picking" && card !== void 0 && card.owner === null && !state.open.includes(index);
}
function pairsOf(state) {
	const count = (side) => state.cards.filter((c) => c.owner === side).length / 2;
	return [count(0), count(1)];
}
function picking(state) {
	return {
		...state,
		phase: {
			kind: "picking",
			until: state.now + PICK_MS$1,
			botAt: state.now + 700
		}
	};
}
const hasBot = (state) => state.controllers.includes("bot");
function flip(state, index) {
	if (!canFlip(state, index)) return state;
	const rng = createRng(state.seed);
	const side = state.turn;
	const card = state.cards[index];
	let memory = state.memory;
	if (hasBot(state) && rng.next() < BOT_MEMORY[state.difficulty].remember) memory = memory.map((f, i) => i === index ? card.face : f);
	const open = [...state.open, index];
	const next = {
		...state,
		seed: rng.seed(),
		memory,
		open,
		flips: [...state.flips, {
			side,
			index
		}]
	};
	if (open.length < 2) return withSounds(picking(next), "flip");
	const [a, b] = open;
	const match = state.cards[a].face === state.cards[b].face;
	const cards = match ? state.cards.map((c, i) => i === a || i === b ? {
		...c,
		owner: side
	} : c) : state.cards;
	return withSounds({
		...next,
		cards,
		phase: {
			kind: "showing",
			until: state.now + (match ? 700 : MISS_SHOW_MS),
			match
		}
	}, "flip", match ? "match" : "miss");
}
/** 봇 기억에서 카드를 확률로 잊는다 (차례가 바뀔 때) */
function forget(rng, state) {
	if (!hasBot(state)) return state.memory;
	const p = BOT_MEMORY[state.difficulty].forget;
	return state.memory.map((f) => f !== null && rng.next() < p ? null : f);
}
function endShowing(state) {
	if (state.phase.kind !== "showing") return state;
	if (state.phase.match) {
		if (state.cards.every((c) => c.owner !== null)) return finish$1({
			...state,
			open: []
		});
		return picking({
			...state,
			open: []
		});
	}
	const rng = createRng(state.seed);
	const memory = forget(rng, state);
	return picking({
		...state,
		seed: rng.seed(),
		memory,
		open: [],
		turn: 1 - state.turn
	});
}
function finish$1(state) {
	const [mine, theirs] = pairsOf(state);
	const winner = mine === theirs ? "draw" : mine > theirs ? 0 : 1;
	const userSide = state.controllers.indexOf("user");
	return withSounds({
		...state,
		phase: {
			kind: "done",
			winner,
			until: state.now + DONE_MS$6
		}
	}, winner === userSide ? "win" : "lose");
}
/** 보여주기·시작 안내가 남아 있으면 바로 끝낸다 (친구 카드가 조금 일찍 도착했을 때) */
function settle$1(state) {
	if (state.phase.kind === "intro") return picking(state);
	if (state.phase.kind === "showing") return endShowing(state);
	return state;
}
function tick$6(state) {
	const { phase, now } = state;
	switch (phase.kind) {
		case "intro": return now >= phase.until ? picking(state) : state;
		case "showing": return now >= phase.until ? endShowing(state) : state;
		case "picking": {
			const who = state.controllers[state.turn];
			if (who === "bot" && now >= phase.botAt) return botFlip(state);
			if (who === "user" && now >= phase.until && !state.hidden) return randomFlip(state);
			return state;
		}
		case "done": return state;
	}
}
function closedCards(state) {
	return state.cards.flatMap((c, i) => c.owner === null && !state.open.includes(i) ? [i] : []);
}
function randomFlip(state) {
	const rng = createRng(state.seed);
	const index = pickOne(rng, closedCards(state));
	return flip({
		...state,
		seed: rng.seed()
	}, index);
}
function botFlip(state) {
	const rng = createRng(state.seed);
	const first = state.open[0];
	const index = chooseBotCard(rng, {
		memory: state.memory,
		available: state.cards.map((c, i) => c.owner === null && !state.open.includes(i)),
		first: first === void 0 ? null : {
			index: first,
			face: state.cards[first].face
		}
	});
	return flip({
		...state,
		seed: rng.seed()
	}, index);
}
function matchReducer(state, action) {
	switch (action.type) {
		case "tick": return tick$6({
			...state,
			now: action.now
		});
		case "pick": return state.controllers[state.turn] === "user" && !state.hidden ? flip(state, action.index) : state;
		case "remoteFlip": {
			if (action.n !== state.flips.length) return state;
			const settled = settle$1(state);
			return settled.controllers[settled.turn] === "remote" && !state.hidden ? flip(settled, action.index) : state;
		}
		case "serverFlip": {
			if (!state.hidden || action.n !== state.flips.length) return state;
			const settled = settle$1(state);
			const cards = settled.cards.map((c, i) => i === action.index ? {
				...c,
				face: action.face
			} : c);
			return flip({
				...settled,
				cards
			}, action.index);
		}
	}
}
//#endregion
//#region src/server/referees/memory.ts
function memoryReferee(setup, ctx) {
	const o = setup ?? {};
	const members = ctx.members();
	const host = members.find((m) => m.role === "host");
	const guest = members.find((m) => m.role === "guest");
	if (!host || !guest || typeof o.guestFirst !== "boolean") return null;
	let s = createMatch({
		now: ctx.now(),
		seed: serverSeed(),
		difficulty: "normal",
		controllers: ["user", "user"],
		deckSeed: serverSeed(),
		first: o.guestFirst ? 1 : 0
	});
	let sent = 0;
	let doneAt = null;
	const flush = () => {
		for (; sent < s.flips.length; sent++) {
			const { index } = s.flips[sent];
			ctx.broadcast({
				t: "flip",
				n: sent,
				index,
				face: s.cards[index].face
			});
		}
		if (doneAt === null && s.phase.kind === "done") doneAt = s.now;
	};
	return {
		input(from, msg) {
			const m = msg ?? {};
			if (m.t !== "flip") return false;
			const side = from === host.id ? 0 : from === guest.id ? 1 : null;
			if (side === null || m.n !== s.flips.length || typeof m.index !== "number") return true;
			s = matchReducer(s, {
				type: "tick",
				now: ctx.now()
			});
			for (let k = 0; k < 3 && (s.phase.kind === "intro" || s.phase.kind === "showing"); k++) s = matchReducer(s, {
				type: "tick",
				now: s.phase.until
			});
			if (s.phase.kind === "picking" && s.turn === side) s = matchReducer(s, {
				type: "pick",
				index: m.index
			});
			flush();
			return true;
		},
		tick(now) {
			s = matchReducer(s, {
				type: "tick",
				now: Math.max(now, s.now)
			});
			flush();
		},
		leave() {},
		finished: () => doneAt !== null && s.now - doneAt > 5e3
	};
}
//#endregion
//#region src/games/nunchi/constants.ts
/** 한 판에 누를 수 있는 시간. 끝나면 안 누른 사람 모두 탈락 */
const CALL_MS = 1e4;
/** 판 시작 전 3·2·1 */
const COUNTDOWN_MS$1 = 2400;
/** 판 결과(탈락자) 보여주기 */
const RESULT_MS = 2400;
/** 결승 가위바위보: 고르는 시간, 공개 보여주기 */
const RPS_PICK_MS = 3e3;
const RPS_REVEAL_MS = 1800;
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
const DONE_MS$5 = 2500;
/** 봇이 누를 시각 (판 시작부터): 성격마다 다름 */
const BOT_STYLES = [
	[300, 2500],
	[1200, 5500],
	[2500, 8500]
];
//#endregion
//#region src/games/nunchi/play/engine.ts
const HANDS$1 = [
	"rock",
	"paper",
	"scissors"
];
const within$3 = (rng, [min, max]) => min + rng.next() * (max - min);
const aliveIndexes$2 = (s) => s.alive.flatMap((a, i) => a ? [i] : []);
function createEngine$5(opts) {
	return countdown({
		now: opts.now,
		seed: opts.seed,
		players: opts.players,
		teams: opts.teams ?? null,
		alive: opts.players.map(() => true),
		out: [],
		round: 1,
		presses: [],
		picks: {},
		botAt: {},
		phase: {
			kind: "countdown",
			until: 0
		}
	});
}
/** 끝났는지: 한 명 남음, 팀전이면 한 팀만 남음 (둘이 남았는데 다른 팀이면 결승 가위바위보) */
function isOver$2(s) {
	return aliveIndexes$2(s).length <= 1 || !!s.teams && lastTeam(s.alive, s.teams) !== null;
}
/** 이긴 팀 (팀전이고 끝났을 때) */
function winnerTeam$3(s) {
	return s.teams ? lastTeam(s.alive, s.teams) : null;
}
function countdown(s) {
	return {
		...s,
		presses: [],
		phase: {
			kind: "countdown",
			until: s.now + COUNTDOWN_MS$1
		}
	};
}
function startCall(s) {
	const rng = createRng(s.seed);
	const botAt = {};
	let botNo = 0;
	s.players.forEach((p, i) => {
		if (p.kind !== "bot" || !s.alive[i]) return;
		botAt[i] = s.now + within$3(rng, BOT_STYLES[botNo++ % BOT_STYLES.length]);
	});
	return {
		...s,
		seed: rng.seed(),
		botAt,
		presses: [],
		phase: {
			kind: "call",
			start: s.now,
			until: s.now + CALL_MS
		}
	};
}
/** 동시에 누른 사람들: 다른 누군가와 COLLIDE_MS 안에 누름 */
function collidedOf(presses) {
	const hit = /* @__PURE__ */ new Set();
	presses.forEach((a, i) => presses.forEach((b, j) => {
		if (i !== j && Math.abs(a.at - b.at) <= 300) hit.add(a.player);
	}));
	return hit;
}
/** 이번 판에 아직 안 누른 살아 있는 사람 */
function waitingOf(s) {
	return aliveIndexes$2(s).filter((i) => !s.presses.some((p) => p.player === i));
}
/**
* 판이 끝났으면 탈락자 정리. 아직이면 null
* - 겹치면 그 자리에서 판이 끝나고 겹친 사람만 탈락, 남은 사람끼리 1부터 다시 (처음엔 판 끝까지 갔는데 바꿈)
* - 안 겹치면 마지막 한 명 / 시간 초과면 안 누른 사람 모두 탈락
*/
function judgeCall(s) {
	if (s.phase.kind !== "call") return null;
	const waiting = waitingOf(s);
	const lastPress = s.presses.at(-1)?.at ?? -Infinity;
	const settled = s.now - lastPress > 300;
	const collided = collidedOf(s.presses);
	const timeout = s.now >= s.phase.until;
	let losers;
	if (collided.size > 0 && (settled || timeout)) losers = [...collided].map((player) => ({
		player,
		reason: "collide"
	}));
	else if (timeout || waiting.length <= 1 && settled) losers = waiting.map((player) => ({
		player,
		reason: timeout && waiting.length > 1 ? "timeout" : "last"
	}));
	else return null;
	const replay = losers.length >= aliveIndexes$2(s).length;
	return {
		...s,
		botAt: {},
		phase: {
			kind: "result",
			losers: replay ? [] : losers,
			replay,
			until: s.now + RESULT_MS
		}
	};
}
function afterResult(s) {
	if (s.phase.kind !== "result") return s;
	const losers = s.phase.losers.map((l) => l.player);
	const next = losers.length ? {
		...s,
		alive: s.alive.map((a, i) => a && !losers.includes(i)),
		out: [...s.out, losers]
	} : s;
	const left = aliveIndexes$2(next).length;
	if (isOver$2(next)) return {
		...next,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$5
		}
	};
	if (left === 2) return startRps({
		...next,
		round: next.round + 1
	});
	return countdown({
		...next,
		round: next.round + 1
	});
}
function startRps(s) {
	const rng = createRng(s.seed);
	const botAt = {};
	for (const i of aliveIndexes$2(s)) if (s.players[i].kind === "bot") botAt[i] = s.now + within$3(rng, [400, 2700]);
	return {
		...s,
		seed: rng.seed(),
		picks: {},
		botAt,
		presses: [],
		phase: {
			kind: "rps",
			until: s.now + RPS_PICK_MS
		}
	};
}
const BEATS = {
	rock: "scissors",
	paper: "rock",
	scissors: "paper"
};
function revealRps(s) {
	const rng = createRng(s.seed);
	const [a, b] = aliveIndexes$2(s);
	const hands = {
		[a]: s.picks[a] ?? pickOne(rng, HANDS$1),
		[b]: s.picks[b] ?? pickOne(rng, HANDS$1)
	};
	const ha = hands[a];
	const hb = hands[b];
	const winner = ha === hb ? null : BEATS[ha] === hb ? a : b;
	return {
		...s,
		seed: rng.seed(),
		botAt: {},
		phase: {
			kind: "reveal",
			hands,
			winner,
			until: s.now + RPS_REVEAL_MS
		}
	};
}
function afterReveal$1(s) {
	if (s.phase.kind !== "reveal") return s;
	const { winner } = s.phase;
	if (winner === null) return startRps(s);
	const loser = aliveIndexes$2(s).find((i) => i !== winner);
	return {
		...s,
		alive: s.alive.map((a, i) => a && i !== loser),
		out: [...s.out, [loser]],
		phase: {
			kind: "done",
			until: s.now + DONE_MS$5
		}
	};
}
function bots$2(s) {
	let next = s;
	for (const [key, at] of Object.entries(s.botAt)) {
		const i = Number(key);
		if (at === void 0 || s.now < at) continue;
		const rest = { ...next.botAt };
		delete rest[i];
		next = {
			...next,
			botAt: rest
		};
		if (s.phase.kind === "call") next = press(next, i);
		if (s.phase.kind === "rps") {
			const rng = createRng(next.seed);
			const hand = pickOne(rng, HANDS$1);
			next = pick({
				...next,
				seed: rng.seed()
			}, i, hand);
		}
	}
	return next;
}
function press(s, player) {
	if (s.phase.kind !== "call" || !s.alive[player] || s.presses.some((p) => p.player === player)) return s;
	return {
		...s,
		presses: [...s.presses, {
			player,
			at: s.now
		}]
	};
}
function pick(s, player, hand) {
	if (s.phase.kind !== "rps" || !s.alive[player]) return s;
	return {
		...s,
		picks: {
			...s.picks,
			[player]: hand
		}
	};
}
function drop$4(s, player) {
	if (!s.alive[player] || s.phase.kind === "done") return s;
	const next = {
		...s,
		alive: s.alive.map((a, i) => a && i !== player),
		out: [...s.out, [player]]
	};
	const left = aliveIndexes$2(next).length;
	if (isOver$2(next)) return {
		...next,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$5
		}
	};
	if (left === 2) return startRps(next);
	return s.phase.kind === "call" ? countdown(next) : next;
}
function tick$5(s) {
	const { phase, now } = s;
	switch (phase.kind) {
		case "countdown": return now >= phase.until ? startCall(s) : s;
		case "call": {
			const b = bots$2(s);
			return judgeCall(b) ?? b;
		}
		case "result": return now >= phase.until ? afterResult(s) : s;
		case "rps": {
			const b = bots$2(s);
			return now >= phase.until ? revealRps(b) : b;
		}
		case "reveal": return now >= phase.until ? afterReveal$1(s) : s;
		case "done": return s;
	}
}
function engineReducer$5(state, action) {
	switch (action.type) {
		case "tick": return tick$5({
			...state,
			now: action.now
		});
		case "press": return press(state, action.player);
		case "pick": return pick(state, action.player, action.hand);
		case "drop": return drop$4(state, action.player);
	}
}
/** 사람별 등수 (1 = 우승). 끝나기 전이면 남은 사람은 모두 1 */
function ranksOf$3(s) {
	const ranks = s.players.map(() => 1);
	let next = aliveIndexes$2(s).length + 1;
	for (const group of [...s.out].reverse()) {
		for (const i of group) ranks[i] = next;
		next += group.length;
	}
	return ranks;
}
//#endregion
//#region src/games/nunchi/play/view.ts
/** 심판 상태 → 화면 */
function toView$5(s) {
	const { phase, now } = s;
	const collided = collidedOf(s.presses);
	return {
		players: s.players.map(({ id, name, avatar }) => ({
			id,
			name,
			avatar
		})),
		teams: s.teams,
		winTeam: phase.kind === "done" ? winnerTeam$3(s) : null,
		alive: s.alive,
		round: s.round,
		phase: phase.kind,
		leftMs: Math.max(0, phase.until - now),
		presses: s.presses.map((p, i) => ({
			player: p.player,
			n: i + 1,
			collided: collided.has(p.player)
		})),
		losers: phase.kind === "result" ? phase.losers : [],
		replay: phase.kind === "result" && phase.replay,
		picked: phase.kind === "rps" ? aliveIndexes$2(s).filter((i) => s.picks[i] !== void 0) : [],
		hands: phase.kind === "reveal" ? phase.hands : {},
		winner: phase.kind === "reveal" ? phase.winner : null,
		ranks: ranksOf$3(s)
	};
}
/** 친구에게 바로 알려야 할 만큼 바뀌었는지 (그 밖엔 1초마다 보냄) */
function viewChanged$4(a, b) {
	if (!a) return true;
	return a.phase !== b.phase || a.round !== b.round || a.presses.length !== b.presses.length || a.presses.some((p, i) => p.collided !== b.presses[i]?.collided) || a.picked.length !== b.picked.length || a.alive.some((x, i) => x !== b.alive[i]);
}
//#endregion
//#region src/server/referees/nunchi.ts
const HANDS = [
	"rock",
	"paper",
	"scissors"
];
function nunchiReferee(setup, ctx) {
	const o = setup ?? {};
	const players = readPlayers(o.players, ctx, 3, 6);
	if (!players) return null;
	const teams = readTeams(o.teams, players.length);
	if (teams === void 0) return null;
	return hostEngineReferee(ctx, {
		state: createEngine$5({
			now: ctx.now(),
			seed: serverSeed(),
			players,
			teams
		}),
		reduce: engineReducer$5,
		tick: (now) => ({
			type: "tick",
			now
		}),
		toView: toView$5,
		changed: viewChanged$4,
		input: (s, from, m) => {
			if (m.t !== "press" && m.t !== "pick") return void 0;
			const player = humanIndex(s.players, from);
			if (player < 0) return null;
			if (m.t === "press") return {
				type: "press",
				player
			};
			return typeof m.hand === "string" && HANDS.includes(m.hand) ? {
				type: "pick",
				player,
				hand: m.hand
			} : null;
		},
		drop: (s, key) => {
			const player = humanIndex(s.players, key);
			return player >= 0 ? {
				type: "drop",
				player
			} : null;
		},
		done: (s) => s.phase.kind === "done",
		nowOf: (s) => s.now
	});
}
//#endregion
//#region src/games/omok/constants.ts
/** 흑·백 카드 고르기. 넘기면 무작위 */
const PICK_MS = 1e4;
//#endregion
//#region src/server/referees/omok.ts
function omokReferee(setup, ctx) {
	const o = setup ?? {};
	const members = ctx.members();
	const host = members.find((m) => m.role === "host");
	const guest = members.find((m) => m.role === "guest");
	if (!host || !guest || typeof o.guestPicks !== "boolean") return null;
	const picker = o.guestPicks ? guest.id : host.id;
	const blackCard = crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(1))[0] % 2;
	const deadline = ctx.now() + PICK_MS + 1e3;
	let pickedAt = null;
	const reveal = (card) => {
		pickedAt = ctx.now();
		ctx.broadcast({
			t: "pick",
			card,
			blackCard
		});
	};
	return {
		input(from, msg) {
			const m = msg ?? {};
			if (m.t !== "pick") return false;
			if (pickedAt === null && from === picker && (m.card === 0 || m.card === 1)) reveal(m.card);
			return true;
		},
		tick(now) {
			if (pickedAt === null && now >= deadline) reveal(crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(1))[0] % 2);
		},
		leave() {},
		finished: () => pickedAt !== null && ctx.now() - pickedAt > 3e3
	};
}
//#endregion
//#region src/games/numbaseball/rules/numbers.ts
function isValidNumber(digits, length) {
	return digits.length === length && digits[0] !== 0 && digits.every((d) => Number.isInteger(d) && d >= 0 && d <= 9) && new Set(digits).size === length;
}
function score$1(secret, guess) {
	let strike = 0;
	let ball = 0;
	guess.forEach((d, i) => {
		if (secret[i] === d) strike++;
		else if (secret.includes(d)) ball++;
	});
	return {
		strike,
		ball
	};
}
const isSolved = (s, length) => s.strike === length;
//#endregion
//#region src/server/referees/numbaseball.ts
function numbaseballReferee(setup, ctx) {
	const o = setup ?? {};
	const length = o.length === 3 || o.length === 4 ? o.length : null;
	const members = ctx.members();
	const host = members.find((m) => m.role === "host");
	const guest = members.find((m) => m.role === "guest");
	if (!length || !host || !guest || typeof o.guestFirst !== "boolean") return null;
	const first = o.guestFirst ? guest.id : host.id;
	const second = o.guestFirst ? host.id : guest.id;
	const other = (k) => k === host.id ? guest.id : host.id;
	const secrets = /* @__PURE__ */ new Map();
	const tries = /* @__PURE__ */ new Map([[host.id, []], [guest.id, []]]);
	let doneAt = null;
	const isDigits = (x) => Array.isArray(x) && x.length === length && x.every((d) => Number.isInteger(d) && d >= 0 && d <= 9);
	return {
		input(from, msg) {
			const m = msg ?? {};
			if (m.t === "answer" || m.t === "reveal" || m.t === "locked") return true;
			if (m.t !== "secret" && m.t !== "guess") return false;
			const mine = tries.get(from);
			if (!mine || doneAt !== null) return true;
			if (m.t === "secret") {
				if (secrets.has(from) || !isDigits(m.digits) || !isValidNumber(m.digits, length)) return true;
				secrets.set(from, m.digits);
				ctx.sendTo(other(from), { t: "locked" });
				return true;
			}
			const theirs = secrets.get(other(from));
			if (!secrets.has(from) || !theirs || !isDigits(m.digits) || !isValidNumber(m.digits, length) || m.n !== mine.length) return true;
			const a = tries.get(first).length;
			const b = tries.get(second).length;
			if (!(from === first ? a === b : a === b + 1) || mine.length >= 12) return true;
			const s = score$1(theirs, m.digits);
			mine.push({
				digits: m.digits,
				solved: isSolved(s, length)
			});
			ctx.sendTo(other(from), {
				t: "guess",
				n: m.n,
				digits: m.digits
			});
			ctx.sendTo(from, {
				t: "answer",
				n: m.n,
				strike: s.strike,
				ball: s.ball
			});
			const [x, y] = [tries.get(first), tries.get(second)];
			if (x.length === y.length && (x.some((t) => t.solved) || y.some((t) => t.solved) || x.length >= 12)) {
				doneAt = ctx.now();
				ctx.sendTo(host.id, {
					t: "reveal",
					digits: [...secrets.get(guest.id)]
				});
				ctx.sendTo(guest.id, {
					t: "reveal",
					digits: [...secrets.get(host.id)]
				});
			}
			return true;
		},
		tick() {},
		leave() {},
		finished: () => doneAt !== null && ctx.now() - doneAt > 5e3
	};
}
//#endregion
//#region src/games/roulette/constants.ts
/** 시작 전 안내 */
const INTRO_MS$3 = 1500;
/** 한 차례 시간. 넘기면 골라 둔 사람(없으면 아무나)을 쏜다 */
const TURN_MS$2 = 15e3;
/** 방아쇠: 철컥 뒤 SUSPENSE_MS에 '틱' 또는 '탕' */
const SUSPENSE_MS = 1100;
const BANG_SHOW_MS = 2400;
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
const DONE_MS$4 = 2500;
/** 봇: 누구를 쏠지 고르기까지, 고른 뒤 당기기까지 */
const BOT_AIM_MS = [700, 1600];
const BOT_PULL_MS = [500, 1100];
//#endregion
//#region src/games/roulette/bot/rouletteBot.ts
function chooseTarget(rng, me, alive, pulls) {
	const others = alive.filter((i) => i !== me);
	if (others.length === 0) return me;
	const risk = 1 / (6 - pulls);
	return chance(rng, risk <= 1 / 6 ? .45 : risk <= 1 / 5 ? .2 : risk < 1 ? .05 : 0) ? me : pickOne(rng, others);
}
//#endregion
//#region src/games/roulette/play/engine.ts
const aliveIndexes$1 = (s) => s.alive.flatMap((a, i) => a ? [i] : []);
const within$2 = (rng, [min, max]) => min + rng.next() * (max - min);
/** 자리 순서로 from 다음 살아 있는 사람 */
function nextAlive$1(alive, from) {
	for (let k = 1; k <= alive.length; k++) {
		const i = (from + k) % alive.length;
		if (alive[i]) return i;
	}
	return from;
}
/** player가 target을 쏠 수 있는지 (살아 있고, 같은 팀 공격을 껐으면 같은 팀이 아님 — 나는 늘 됨) */
function canTarget(s, player, target) {
	return !!s.alive[target] && (s.friendlyFire || !sameTeam(s.teams, player, target));
}
/** 봇이 고르는 사람들: 같은 팀 공격이 켜져 있어도 같은 팀은 빼고 (나는 됨) */
const botTargetsOf = (s, player) => aliveIndexes$1(s).filter((i) => !sameTeam(s.teams, player, i));
/** 끝났는지: 한 명 남음, 팀전이면 한 팀만 남음 */
function isOver$1(s) {
	return aliveIndexes$1(s).length <= 1 || !!s.teams && lastTeam(s.alive, s.teams) !== null;
}
/** 이긴 팀 (팀전이고 끝났을 때) */
function winnerTeam$2(s) {
	return s.teams ? lastTeam(s.alive, s.teams) : null;
}
function reload(s) {
	const rng = createRng(s.seed);
	const chamber = 1 + Math.floor(rng.next() * 6);
	return {
		...s,
		seed: rng.seed(),
		chamber,
		pulls: 0
	};
}
function createEngine$4(opts) {
	const rng = createRng(opts.seed);
	const turn = Math.floor(rng.next() * opts.players.length);
	return reload({
		now: opts.now,
		seed: rng.seed(),
		players: opts.players,
		teams: opts.teams ?? null,
		friendlyFire: !!opts.friendlyFire,
		alive: opts.players.map(() => true),
		out: [],
		kills: opts.players.map(() => 0),
		turn,
		aimAt: null,
		chamber: 1,
		pulls: 0,
		bot: null,
		phase: {
			kind: "intro",
			until: opts.now + INTRO_MS$3
		}
	});
}
/** turn 사람 차례 시작 (봇이면 언제 고르고 당길지 정해 둔다) */
function startTurn$1(s, turn) {
	let next = {
		...s,
		turn,
		aimAt: null,
		bot: null,
		phase: {
			kind: "aim",
			until: s.now + TURN_MS$2
		}
	};
	if (s.players[turn].kind === "bot") {
		const rng = createRng(s.seed);
		const target = chooseTarget(rng, turn, botTargetsOf(s, turn), s.pulls);
		const aimAt = s.now + within$2(rng, BOT_AIM_MS);
		next = {
			...next,
			seed: rng.seed(),
			bot: {
				aimAt,
				pullAt: aimAt + within$2(rng, BOT_PULL_MS),
				target
			}
		};
	}
	return next;
}
function aim(s, player, target) {
	if (s.phase.kind !== "aim" || player !== s.turn || !canTarget(s, player, target)) return s;
	return {
		...s,
		aimAt: target
	};
}
function pull(s, player, target = s.aimAt) {
	if (s.phase.kind !== "aim" || player !== s.turn || target === null || !canTarget(s, player, target)) return s;
	const pulls = s.pulls + 1;
	const bang = pulls >= s.chamber;
	const fire = {
		shooter: player,
		target,
		bang
	};
	return {
		...s,
		aimAt: target,
		pulls,
		bot: null,
		phase: {
			kind: "fire",
			fire,
			until: s.now + SUSPENSE_MS + (bang ? BANG_SHOW_MS : 900)
		}
	};
}
function afterFire(s) {
	if (s.phase.kind !== "fire") return s;
	const { shooter, target, bang } = s.phase.fire;
	if (!bang) return startTurn$1(s, s.alive[target] ? target : nextAlive$1(s.alive, target));
	const next = {
		...s,
		alive: s.alive.map((a, i) => a && i !== target),
		out: [...s.out, target],
		kills: s.kills.map((k, i) => i === shooter && shooter !== target ? k + 1 : k)
	};
	if (isOver$1(next)) return {
		...next,
		aimAt: null,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$4
		}
	};
	const turn = next.alive[shooter] ? shooter : nextAlive$1(next.alive, shooter);
	return startTurn$1(reload(next), turn);
}
function timeout(s) {
	const rng = createRng(s.seed);
	const alive = aliveIndexes$1(s).filter((i) => canTarget(s, s.turn, i));
	const target = s.aimAt ?? alive[Math.floor(rng.next() * alive.length)];
	return pull({
		...s,
		seed: rng.seed()
	}, s.turn, target);
}
function bots$1(s) {
	const b = s.bot;
	if (!b) return s;
	let next = s;
	if (s.now >= b.aimAt && s.aimAt !== b.target) next = aim(next, s.turn, b.target);
	if (s.now >= b.pullAt) next = pull(next, s.turn, b.target);
	return next;
}
function drop$3(s, player) {
	if (!s.alive[player] || s.phase.kind === "done") return s;
	const next = {
		...s,
		alive: s.alive.map((a, i) => a && i !== player),
		out: [...s.out, player]
	};
	if (isOver$1(next)) return {
		...next,
		aimAt: null,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$4
		}
	};
	if (s.phase.kind === "aim") {
		if (s.turn === player) return startTurn$1(next, nextAlive$1(next.alive, player));
		if (s.aimAt === player) return {
			...next,
			aimAt: null
		};
	}
	return next;
}
function tick$4(s) {
	const { phase, now } = s;
	switch (phase.kind) {
		case "intro": return now >= phase.until ? startTurn$1(s, s.turn) : s;
		case "aim": {
			const b = bots$1(s);
			if (b.phase.kind !== "aim") return b;
			return now >= phase.until ? timeout(b) : b;
		}
		case "fire": return now >= phase.until ? afterFire(s) : s;
		case "done": return s;
	}
}
function engineReducer$4(state, action) {
	switch (action.type) {
		case "tick": return tick$4({
			...state,
			now: action.now
		});
		case "aim": return aim(state, action.player, action.target);
		case "pull": return pull(state, action.player, action.target ?? state.aimAt);
		case "drop": return drop$3(state, action.player);
	}
}
/** 사람별 등수 (1 = 우승). 늦게 탈락할수록 앞. 끝나기 전이면 남은 사람은 모두 1 */
function ranksOf$2(s) {
	const ranks = s.players.map(() => 1);
	const left = aliveIndexes$1(s).length;
	[...s.out].reverse().forEach((i, k) => ranks[i] = left + 1 + k);
	return ranks;
}
//#endregion
//#region src/games/roulette/play/view.ts
/** 심판 상태 → 화면 */
function toView$4(s) {
	const { phase, now } = s;
	return {
		players: s.players.map(({ id, name, avatar }) => ({
			id,
			name,
			avatar
		})),
		teams: s.teams,
		friendlyFire: s.friendlyFire,
		winTeam: s.phase.kind === "done" ? winnerTeam$2(s) : null,
		alive: s.alive,
		kills: s.kills,
		turn: s.turn,
		aimAt: s.aimAt,
		pulls: s.pulls,
		phase: phase.kind,
		leftMs: Math.max(0, phase.until - now),
		fire: phase.kind === "fire" ? phase.fire : null,
		ranks: ranksOf$2(s)
	};
}
/** 친구에게 바로 알려야 할 만큼 바뀌었는지 (그 밖엔 1초마다 보냄) */
function viewChanged$3(a, b) {
	if (!a) return true;
	return a.phase !== b.phase || a.turn !== b.turn || a.aimAt !== b.aimAt || a.pulls !== b.pulls || a.alive.some((x, i) => x !== b.alive[i]);
}
//#endregion
//#region src/server/referees/roulette.ts
function rouletteReferee(setup, ctx) {
	const o = setup ?? {};
	const players = readPlayers(o.players, ctx, 2, 8);
	if (!players) return null;
	const teams = readTeams(o.teams, players.length);
	if (teams === void 0) return null;
	return hostEngineReferee(ctx, {
		state: createEngine$4({
			now: ctx.now(),
			seed: serverSeed(),
			players,
			teams,
			friendlyFire: o.friendlyFire === true
		}),
		reduce: engineReducer$4,
		tick: (now) => ({
			type: "tick",
			now
		}),
		toView: toView$4,
		changed: viewChanged$3,
		input: (s, from, m) => {
			if (m.t !== "aim" && m.t !== "pull") return void 0;
			const player = humanIndex(s.players, from);
			if (player < 0 || !isInt$1(m.target)) return null;
			return m.t === "aim" ? {
				type: "aim",
				player,
				target: m.target
			} : {
				type: "pull",
				player,
				target: m.target
			};
		},
		drop: (s, key) => {
			const player = humanIndex(s.players, key);
			return player >= 0 ? {
				type: "drop",
				player
			} : null;
		},
		done: (s) => s.phase.kind === "done",
		nowOf: (s) => s.now
	});
}
//#endregion
//#region src/games/survival/constants.ts
/** 남은 사람 수별 맵 반지름 (2명 → 30 … 8명 → 60). 누가 탈락하면 다음 라운드에 줄어든다.
*  처음엔 5라운드까지 라운드마다 줄였는데(50→20), 사람 수에 맞추고 둘이면 적당히 넓게 두기로 바꿈 */
const ARENA_BY_PLAYERS = {
	2: 30,
	3: 35,
	4: 40,
	5: 45,
	6: 50,
	7: 55,
	8: 60
};
const MAX_ARENA = ARENA_BY_PLAYERS[8];
/** 엄폐물(벽): 길이·두께. 라운드마다 무작위로 새로 짓는다 */
const WALL_LEN = [10, 18];
/** 라운드 시작 안내(맵 줄어듦) */
const COUNTDOWN_MS = 1800;
/** 위치·방향 고르는 시간. 넘기면 고른 것까지만 쓰고 나머지는 무작위 */
const PLAN_MS = 15e3;
/** 레이저 속도 (맵 단위/ms). 맵 끝에서 끝(100)까지 2초 — 천천히 뻗어 가며 닿는 순간 ✕ */
const LASER_SPEED = .05;
/** 레이저가 다 멈춘 뒤 결과 보여주기 */
const AFTER_SHOT_MS = 1800;
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
const DONE_MS$3 = 2500;
/** 봇이 정하는 데 걸리는 시간 (고르기 시작부터) */
const BOT_PLAN_MS = [1500, 6e3];
//#endregion
//#region src/games/survival/rules/geometry.ts
/** 남은 사람 수에 맞는 맵 반지름 */
const halfFor = (alive) => ARENA_BY_PLAYERS[Math.max(2, Math.min(8, alive))] ?? MAX_ARENA;
/** 말이 맵 밖으로 나가지 않게 (말 반지름만큼 안쪽) */
function clampToArena(p, half) {
	const m = half - 4;
	const d = Math.hypot(p.x, p.y);
	return d <= m ? p : {
		x: p.x / d * m,
		y: p.y / d * m
	};
}
/** 벽 기준 좌표 (벽 가운데가 0, 길이 방향이 x) */
function toLocal(p, w) {
	const c = Math.cos(w.angle);
	const s = Math.sin(w.angle);
	const dx = p.x - w.x;
	const dy = p.y - w.y;
	return {
		x: dx * c + dy * s,
		y: -dx * s + dy * c
	};
}
function fromLocal(q, w) {
	const c = Math.cos(w.angle);
	const s = Math.sin(w.angle);
	return {
		x: w.x + q.x * c - q.y * s,
		y: w.y + q.x * s + q.y * c
	};
}
/** 말이 벽에 걸치면 가까운 쪽 바깥으로 밀어낸다 */
function pushOutOfWalls(p, walls) {
	let out = p;
	for (const w of walls) {
		const q = toLocal(out, w);
		const ex = w.w / 2 + 4;
		const ey = w.h / 2 + 4;
		if (Math.abs(q.x) >= ex || Math.abs(q.y) >= ey) continue;
		out = fromLocal(ex - Math.abs(q.x) < ey - Math.abs(q.y) ? {
			x: Math.sign(q.x || 1) * ex,
			y: q.y
		} : {
			x: q.x,
			y: Math.sign(q.y || 1) * ey
		}, w);
	}
	return out;
}
/** 말을 놓을 수 있는 자리로: 맵 안, 벽 밖 (밀어낸 뒤 다시 맵 안으로) */
function placeAt(p, half, walls) {
	let out = clampToArena(p, half);
	for (let k = 0; k < 3; k++) out = clampToArena(pushOutOfWalls(out, walls), half);
	return out;
}
/** 앞으로 나가는 선이 벽에 닿는 거리 (안 닿으면 null) */
function rayWall(from, dx, dy, w) {
	const o = toLocal(from, w);
	const c = Math.cos(w.angle);
	const s = Math.sin(w.angle);
	const d = {
		x: dx * c + dy * s,
		y: -dx * s + dy * c
	};
	let tMin = -Infinity;
	let tMax = Infinity;
	for (const [oo, dd, e] of [[
		o.x,
		d.x,
		w.w / 2
	], [
		o.y,
		d.y,
		w.h / 2
	]]) {
		if (Math.abs(dd) < 1e-9) {
			if (Math.abs(oo) > e) return null;
			continue;
		}
		const t1 = (-e - oo) / dd;
		const t2 = (e - oo) / dd;
		tMin = Math.max(tMin, Math.min(t1, t2));
		tMax = Math.min(tMax, Math.max(t1, t2));
	}
	if (tMax < Math.max(0, tMin)) return null;
	return Math.max(0, tMin);
}
/** 라운드마다 엄폐물 짓기: 맵이 클수록 많이(7~8명 4개 · 5~6명 3개 · 3~4명 2개 · 2명 1개, 처음 5~3개는 너무 많아 줄임), 서로 떨어지게, 맵 안에 다 들어오게 */
function makeWalls(rng, half) {
	const count = half < 24 ? 0 : Math.max(1, Math.min(4, Math.round((half - 20) / 10)));
	const walls = [];
	for (let tries = 0; walls.length < count && tries < 200; tries++) {
		const w = WALL_LEN[0] + rng.next() * (WALL_LEN[1] - WALL_LEN[0]);
		const r = Math.sqrt(rng.next()) * (half - w / 2 - 3);
		const a = rng.next() * Math.PI * 2;
		const wall = {
			x: Math.cos(a) * r,
			y: Math.sin(a) * r,
			w,
			h: 3,
			angle: rng.next() * Math.PI
		};
		if (walls.every((o) => Math.hypot(o.x - wall.x, o.y - wall.y) >= Math.min(16, half * .45))) walls.push(wall);
	}
	return walls;
}
/** 맵 안 아무 곳 (넓이 고르게) */
function randomInArena(rng, half) {
	const r = Math.sqrt(rng.next()) * (half - 4);
	const a = rng.next() * Math.PI * 2;
	return {
		x: Math.cos(a) * r,
		y: Math.sin(a) * r
	};
}
/** 맵 안, 벽 밖 아무 곳 */
function randomSpot(rng, half, walls) {
	return placeAt(randomInArena(rng, half), half, walls);
}
/** 쏜 자리에서 그 방향으로 맵 끝에 닿는 곳 */
function edgeOf(from, angle, half) {
	const dx = Math.cos(angle);
	const dy = Math.sin(angle);
	const b = from.x * dx + from.y * dy;
	const c = from.x * from.x + from.y * from.y - half * half;
	const t = Math.max(0, -b + Math.sqrt(Math.max(0, b * b - c)));
	return {
		x: from.x + dx * t,
		y: from.y + dy * t
	};
}
/**
* 총알: 처음 맞는 사람과 총알이 멈춘 곳.
* 말(반지름 PIECE_R)에 닿는 첫 지점까지 거리로 가장 가까운 사람. 쏜 사람 뒤쪽은 안 맞는다
*/
function shoot(from, angle, targets, half, walls = []) {
	const dx = Math.cos(angle);
	const dy = Math.sin(angle);
	let best = null;
	for (const w of walls) {
		const t = rayWall(from, dx, dy, w);
		if (t !== null && (!best || t < best.t)) best = {
			player: null,
			t
		};
	}
	for (const { player, pos } of targets) {
		const vx = pos.x - from.x;
		const vy = pos.y - from.y;
		const along = vx * dx + vy * dy;
		if (along <= 0) continue;
		const side2 = vx * vx + vy * vy - along * along;
		if (side2 > 16) continue;
		const t = Math.max(0, along - Math.sqrt(16 - side2));
		if (!best || t < best.t) best = {
			player,
			t
		};
	}
	if (!best) return {
		hit: null,
		end: edgeOf(from, angle, half)
	};
	return {
		hit: best.player,
		end: {
			x: from.x + dx * best.t,
			y: from.y + dy * best.t
		}
	};
}
//#endregion
//#region src/games/survival/bot/survivalBot.ts
/** lastSeen: 살아 있는 상대들의 지난 라운드 자리 (첫 라운드면 null) */
function chooseBotPlan(rng, half, walls, lastSeen) {
	const pos = randomSpot(rng, half, walls);
	const known = lastSeen.filter((p) => p !== null);
	const aimAt = known.length > 0 && chance(rng, .6) ? pickOne(rng, known) : randomInArena(rng, half * .8);
	const jitter = (rng.next() - .5) * half * .3;
	const dx = aimAt.x + jitter - pos.x;
	const dy = aimAt.y - jitter - pos.y;
	return {
		pos,
		angle: Math.hypot(dx, dy) < 1 ? rng.next() * Math.PI * 2 : Math.atan2(dy, dx)
	};
}
//#endregion
//#region src/games/survival/play/engine.ts
/** 레이저가 끝(맞은 곳·맵 끝)까지 가는 데 걸리는 시간 */
const laserMs = (sh) => Math.hypot(sh.end.x - sh.pos.x, sh.end.y - sh.pos.y) / LASER_SPEED;
/** 공개 시작부터 레이저가 모두 멈추는 시각 */
const lasersDoneAt = (r) => 700 + Math.max(0, ...r.shots.map(laserMs));
const aliveIndexes = (s) => s.alive.flatMap((a, i) => a ? [i] : []);
/** 라운드 준비: 남은 사람 수로 맵 크기를 정하고(줄이는 중이면 그 크기) 엄폐물을 새로 짓는다 */
function buildWalls(s, half = halfFor(aliveIndexes(s).length)) {
	const rng = createRng(s.seed);
	const walls = makeWalls(rng, half);
	return {
		...s,
		seed: rng.seed(),
		half,
		walls
	};
}
function createEngine$3(opts) {
	return buildWalls({
		now: opts.now,
		seed: opts.seed,
		players: opts.players,
		teams: opts.teams ?? null,
		friendlyFire: !!opts.friendlyFire,
		alive: opts.players.map(() => true),
		out: [],
		kills: opts.players.map(() => 0),
		round: 1,
		half: 0,
		walls: [],
		plans: {},
		botAt: {},
		lastReveal: null,
		phase: {
			kind: "countdown",
			until: opts.now + COUNTDOWN_MS
		}
	});
}
/** 끝났는지: 한 명 남음, 팀전이면 한 팀만 남음 */
function isOver(s) {
	return aliveIndexes(s).length <= 1 || !!s.teams && lastTeam(s.alive, s.teams) !== null;
}
/** 이긴 팀 (팀전이고 끝났을 때) */
function winnerTeam$1(s) {
	return s.teams ? lastTeam(s.alive, s.teams) : null;
}
const within$1 = (rng, [min, max]) => min + rng.next() * (max - min);
function startPlan(s) {
	const rng = createRng(s.seed);
	const botAt = {};
	for (const i of aliveIndexes(s)) if (s.players[i].kind === "bot") botAt[i] = s.now + within$1(rng, BOT_PLAN_MS);
	return {
		...s,
		seed: rng.seed(),
		plans: {},
		botAt,
		phase: {
			kind: "plan",
			until: s.now + PLAN_MS
		}
	};
}
function bots(s) {
	let next = s;
	for (const [key, at] of Object.entries(s.botAt)) {
		const i = Number(key);
		if (at === void 0 || s.now < at) continue;
		const rest = { ...next.botAt };
		delete rest[i];
		const rng = createRng(next.seed);
		const lastSeen = aliveIndexes(next).filter((j) => j !== i && !sameTeam(next.teams, i, j)).map((j) => next.lastReveal?.positions[j] ?? null);
		const { pos, angle } = chooseBotPlan(rng, next.half, next.walls, lastSeen);
		next = {
			...next,
			seed: rng.seed(),
			botAt: rest,
			plans: {
				...next.plans,
				[i]: {
					pos,
					angle,
					locked: true
				}
			}
		};
	}
	return next;
}
function plan(s, player, p) {
	if (s.phase.kind !== "plan" || !s.alive[player] || s.plans[player]?.locked) return s;
	const half = s.half;
	const pos = p.pos && placeAt(p.pos, half, s.walls);
	return {
		...s,
		plans: {
			...s.plans,
			[player]: {
				pos,
				angle: p.angle,
				locked: p.locked && pos !== null && p.angle !== null
			}
		}
	};
}
/** 공개: 안 고른 건 무작위로 채우고 모두 동시에 쏜다 */
function reveal(s) {
	const rng = createRng(s.seed);
	const half = s.half;
	const alive = aliveIndexes(s);
	const positions = s.players.map(() => null);
	const angles = s.players.map(() => 0);
	for (const i of alive) {
		const p = s.plans[i];
		positions[i] = p?.pos ?? randomSpot(rng, half, s.walls);
		angles[i] = p?.angle ?? rng.next() * Math.PI * 2;
	}
	const shots = alive.map((i) => {
		const targets = alive.filter((j) => j !== i && (s.friendlyFire || !sameTeam(s.teams, i, j))).map((j) => ({
			player: j,
			pos: positions[j]
		}));
		const { hit, end } = shoot(positions[i], angles[i], targets, half, s.walls);
		return {
			from: i,
			pos: positions[i],
			end,
			hit
		};
	});
	const hits = [...new Set(shots.flatMap((sh) => sh.hit === null ? [] : [sh.hit]))].sort((a, b) => a - b);
	const voided = hits.length >= alive.length;
	const ms = lasersDoneAt({ shots }) + AFTER_SHOT_MS;
	return {
		...s,
		seed: rng.seed(),
		botAt: {},
		lastReveal: {
			round: s.round,
			half,
			positions,
			shots,
			dead: voided ? [] : hits,
			voided,
			ms
		},
		phase: {
			kind: "reveal",
			until: s.now + ms
		}
	};
}
function afterReveal(s) {
	const r = s.lastReveal;
	if (!r) return s;
	const kills = r.voided ? s.kills : s.kills.map((k, i) => k + r.shots.filter((sh) => sh.from === i && sh.hit !== null).length);
	const next = r.dead.length ? {
		...s,
		kills,
		alive: s.alive.map((a, i) => a && !r.dead.includes(i)),
		out: [...s.out, r.dead]
	} : {
		...s,
		kills
	};
	if (isOver(next)) return {
		...next,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$3
		}
	};
	const alive = aliveIndexes(next).length;
	const half = (alive === 2 || s.teams) && r.dead.length === 0 ? Math.max(14, Math.min(s.half, halfFor(alive)) - 4) : halfFor(alive);
	return buildWalls({
		...next,
		round: next.round + 1,
		plans: {},
		phase: {
			kind: "countdown",
			until: s.now + COUNTDOWN_MS
		}
	}, half);
}
function drop$2(s, player) {
	if (!s.alive[player] || s.phase.kind === "done") return s;
	const next = {
		...s,
		alive: s.alive.map((a, i) => a && i !== player),
		out: [...s.out, [player]]
	};
	if (isOver(next)) return {
		...next,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$3
		}
	};
	return next;
}
/** 살아 있는 사람이 모두 확정했는지 */
const allLocked = (s) => aliveIndexes(s).every((i) => s.plans[i]?.locked);
function tick$3(s) {
	const { phase, now } = s;
	switch (phase.kind) {
		case "countdown": return now >= phase.until ? startPlan(s) : s;
		case "plan": {
			const b = bots(s);
			return now >= phase.until || allLocked(b) ? reveal(b) : b;
		}
		case "reveal": return now >= phase.until ? afterReveal(s) : s;
		case "done": return s;
	}
}
function engineReducer$3(state, action) {
	switch (action.type) {
		case "tick": return tick$3({
			...state,
			now: action.now
		});
		case "plan": return plan(state, action.player, action.plan);
		case "drop": return drop$2(state, action.player);
	}
}
/** 사람별 등수 (1 = 우승). 끝나기 전이면 남은 사람은 모두 1 */
function ranksOf$1(s) {
	const ranks = s.players.map(() => 1);
	let next = aliveIndexes(s).length + 1;
	for (const group of [...s.out].reverse()) {
		for (const i of group) ranks[i] = next;
		next += group.length;
	}
	return ranks;
}
//#endregion
//#region src/games/survival/play/view.ts
/** 심판 상태 → 화면 */
function toView$3(s) {
	const { phase, now } = s;
	return {
		players: s.players.map(({ id, name, avatar }) => ({
			id,
			name,
			avatar
		})),
		teams: s.teams,
		winTeam: phase.kind === "done" ? winnerTeam$1(s) : null,
		alive: s.alive,
		kills: s.kills,
		round: s.round,
		half: s.half,
		prevHalf: s.lastReveal?.half ?? s.half,
		startHalf: halfFor(s.players.length),
		walls: s.walls,
		phase: phase.kind,
		leftMs: Math.max(0, phase.until - now),
		locked: phase.kind === "plan" ? aliveIndexes(s).filter((i) => s.plans[i]?.locked) : [],
		reveal: phase.kind === "reveal" || phase.kind === "done" ? s.lastReveal : null,
		ranks: ranksOf$1(s)
	};
}
/** 친구에게 바로 알려야 할 만큼 바뀌었는지 (그 밖엔 1초마다 보냄) */
function viewChanged$2(a, b) {
	if (!a) return true;
	return a.phase !== b.phase || a.round !== b.round || a.locked.length !== b.locked.length || a.alive.some((x, i) => x !== b.alive[i]);
}
//#endregion
//#region src/server/referees/survival.ts
function survivalReferee(setup, ctx) {
	const o = setup ?? {};
	const players = readPlayers(o.players, ctx, 2, 8);
	if (!players) return null;
	const teams = readTeams(o.teams, players.length);
	if (teams === void 0) return null;
	return hostEngineReferee(ctx, {
		state: createEngine$3({
			now: ctx.now(),
			seed: serverSeed(),
			players,
			teams,
			friendlyFire: o.friendlyFire === true
		}),
		reduce: engineReducer$3,
		tick: (now) => ({
			type: "tick",
			now
		}),
		toView: toView$3,
		changed: viewChanged$2,
		input: (s, from, m) => {
			if (m.t !== "plan") return void 0;
			const player = humanIndex(s.players, from);
			const p = m.plan;
			if (player < 0 || m.round !== s.round || !p || typeof p !== "object") return null;
			if (p.pos !== null && !isVec(p.pos) || p.angle !== null && !isNum(p.angle) || typeof p.locked !== "boolean") return null;
			return {
				type: "plan",
				player,
				plan: {
					pos: p.pos,
					angle: p.angle,
					locked: p.locked
				}
			};
		},
		drop: (s, key) => {
			const player = humanIndex(s.players, key);
			return player >= 0 ? {
				type: "drop",
				player
			} : null;
		},
		done: (s) => s.phase.kind === "done",
		nowOf: (s) => s.now
	});
}
//#endregion
//#region src/games/tiles/constants.ts
/** 첫 차례 전 안내 */
const INTRO_MS$2 = 1800;
/** 한 차례 시간. 넘기면 하던 것은 되돌리고 1장 가져온다 */
const TURN_MS$1 = 6e4;
/** 봇이 한 차례 생각하는 시간 */
const BOT_THINK_MS = [1200, 2600];
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
const DONE_MS$2 = 3e3;
//#endregion
//#region src/games/tiles/rules/tiles.ts
const NUMBER_TILES = 104;
const TILE_COUNT = 106;
function isWild(id) {
	return id >= NUMBER_TILES;
}
/** 1~13 (와일드는 0) */
function numOf(id) {
	return isWild(id) ? 0 : id % 13 + 1;
}
/** 0~3 (와일드는 -1) */
function colorOf(id) {
	return isWild(id) ? -1 : Math.floor(id / 13) % 4;
}
Array.from({ length: 2 }, (_, i) => NUMBER_TILES + i);
/** 섞은 타일 더미 */
function shuffledDeck(rng) {
	const deck = Array.from({ length: TILE_COUNT }, (_, i) => i);
	for (let i = deck.length - 1; i > 0; i--) {
		const j = Math.floor(rng.next() * (i + 1));
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}
	return deck;
}
/** 남은 손패 점수 (끝났을 때 순위용). 와일드는 MAX_NUM(13) */
function handValue(ids) {
	return ids.reduce((sum, id) => sum + (isWild(id) ? 13 : numOf(id)), 0);
}
//#endregion
//#region src/games/tiles/rules/sets.ts
/** 놓인 순서대로 같은 색 연속이면 각 자리 숫자 */
function runNumbers(ids) {
	if (ids.length < 3 || ids.length > 13) return null;
	const first = ids.findIndex((id) => !isWild(id));
	if (first < 0) return null;
	const color = colorOf(ids[first]);
	const start = numOf(ids[first]) - first;
	if (start < 1 || start + ids.length - 1 > 13) return null;
	return ids.every((id, i) => isWild(id) || colorOf(id) === color && numOf(id) === start + i) ? ids.map((_, i) => start + i) : null;
}
/** 같은 숫자 다른 색이면 그 숫자 */
function groupNumber(ids) {
	const plain = ids.filter((id) => !isWild(id));
	if (ids.length < 3 || ids.length > 4 || plain.length === 0) return null;
	const n = numOf(plain[0]);
	if (plain.some((id) => numOf(id) !== n)) return null;
	return new Set(plain.map(colorOf)).size === plain.length ? n : null;
}
/** 올바른 줄이면 그 종류 (둘 다 되면 점수가 큰 쪽), 아니면 null */
function setKind(ids) {
	const run = runNumbers(ids);
	const group = groupNumber(ids);
	if (run && group !== null) return sum(run) >= group * ids.length ? "run" : "group";
	return run ? "run" : group !== null ? "group" : null;
}
function isValidSet(ids) {
	return setKind(ids) !== null;
}
const sum = (ns) => ns.reduce((a, b) => a + b, 0);
/** 줄의 점수 (첫 등록 합). 와일드는 그 자리 숫자. 올바르지 않으면 0 */
function setValue(ids) {
	const kind = setKind(ids);
	if (kind === "run") return sum(runNumbers(ids));
	if (kind === "group") return groupNumber(ids) * ids.length;
	return 0;
}
/**
* 순서 없는 타일 묶음을 올바른 줄로 놓는 순서 (봇이 줄을 만들 때 씀). 안 되면 null.
* 연속이면 작은 숫자부터, 와일드는 빈 곳 → 남으면 위쪽 끝 → 13을 넘으면 아래쪽 끝
*/
function orderSet(ids) {
	const plain = ids.filter((id) => !isWild(id)).sort((a, b) => numOf(a) - numOf(b));
	const wilds = ids.filter(isWild);
	const group = [...plain, ...wilds];
	if (groupNumber(group) !== null) return group;
	if (plain.length === 0) return null;
	const lo = numOf(plain[0]);
	const span = numOf(plain[plain.length - 1]) - lo + 1;
	const start = Math.min(13, lo + Math.max(span, ids.length) - 1) - ids.length + 1;
	const left = [...wilds];
	const out = Array.from({ length: ids.length }, (_, i) => plain.find((id) => numOf(id) === start + i) ?? left.shift());
	if (out.some((id) => id === void 0) || new Set(out).size !== ids.length) return null;
	const run = out;
	return isValidSet(run) ? run : null;
}
//#endregion
//#region src/games/tiles/bot/tilesBot.ts
/** 손패에서 만들 수 있는 줄 후보 (와일드는 한 장까지 끼워 봄) */
function candidates(hand) {
	const wild = hand.find(isWild);
	const plain = hand.filter((id) => !isWild(id));
	const out = [];
	for (let n = 1; n <= 13; n++) {
		const byColor = /* @__PURE__ */ new Map();
		for (const id of plain) if (numOf(id) === n && !byColor.has(colorOf(id))) byColor.set(colorOf(id), id);
		const g = [...byColor.values()];
		if (g.length >= 3) out.push(g);
		if (wild !== void 0 && g.length >= 2 && g.length < 4) out.push([...g, wild]);
	}
	for (let c = 0; c < 4; c++) {
		const at = /* @__PURE__ */ new Map();
		for (const id of plain) if (colorOf(id) === c && !at.has(numOf(id))) at.set(numOf(id), id);
		for (let lo = 1; lo <= 13; lo++) {
			const seq = [];
			let usedWild = false;
			for (let n = lo; n <= 13; n++) {
				const id = at.get(n);
				if (id !== void 0) seq.push(id);
				else if (wild !== void 0 && !usedWild && seq.length > 0) {
					seq.push(wild);
					usedWild = true;
				} else break;
				if (seq.length >= 3) out.push([...seq]);
			}
		}
	}
	return out.filter(isValidSet);
}
/** 손패만으로 줄을 욕심껏 고른다 (점수 큰 것부터) */
function setsFromHand(hand) {
	let left = [...hand];
	const sets = [];
	for (;;) {
		const best = candidates(left).sort((a, b) => setValue(b) - setValue(a) || b.length - a.length)[0];
		if (!best) return sets;
		sets.push(best);
		left = left.filter((id) => !best.includes(id));
	}
}
/** 낼 바닥 전체, 낼 게 없으면 null */
function chooseBotPlay(table, hand, melded) {
	const sets = setsFromHand(hand);
	if (!melded) return sets.reduce((sum, s) => sum + setValue(s), 0) >= 30 ? [...table, ...sets] : null;
	const next = [...table.map((s) => [...s]), ...sets];
	let left = hand.filter((id) => !sets.some((s) => s.includes(id)));
	for (let changed = true; changed;) {
		changed = false;
		for (const id of left) if (attach(next, id) || split(next, id) || borrow(next, id, left)) {
			left = left.filter((x) => !next.some((s) => s.includes(x)));
			changed = true;
			break;
		}
	}
	return left.length === hand.length ? null : next;
}
/** 줄 뒤(위쪽 숫자)나 앞(아래쪽 숫자)에 붙이기 */
function attach(table, id) {
	for (const s of table) {
		if (isValidSet([...s, id])) {
			s.push(id);
			return true;
		}
		if (isValidSet([id, ...s])) {
			s.unshift(id);
			return true;
		}
	}
	return false;
}
/** 빨강 3~8에 빨강 5 → 3·4·5 / 5·6·7·8 (양쪽 다 3장 이상) */
function split(table, id) {
	if (isWild(id)) return false;
	for (const [i, s] of table.entries()) {
		if (s.some(isWild) || setKind(s) !== "run" || colorOf(s[0]) !== colorOf(id)) continue;
		const low = s.filter((x) => numOf(x) <= numOf(id));
		const high = [id, ...s.filter((x) => numOf(x) > numOf(id))];
		if (low.length >= 3 && high.length >= 3 && isValidSet(low) && isValidSet(high)) {
			table.splice(i, 1, low, high);
			return true;
		}
	}
	return false;
}
/** 빼도 줄이 남는 바닥 타일(긴 연속의 끝, 4장 이상 같은 숫자의 한 장)을 빌려 손패와 새 줄 */
function borrow(table, id, hand) {
	const spares = [];
	for (const s of table) {
		if (s.length <= 3) continue;
		for (const tile of s) if (isValidSet(s.filter((x) => x !== tile))) spares.push({
			set: s,
			tile
		});
	}
	const others = hand.filter((x) => x !== id);
	for (const a of spares) {
		for (const x of others) {
			const set = orderSet([
				id,
				x,
				a.tile
			]);
			if (set) return take(table, set, [a]);
		}
		for (const b of spares) {
			const set = b.set !== a.set ? orderSet([
				id,
				a.tile,
				b.tile
			]) : null;
			if (set) return take(table, set, [a, b]);
		}
	}
	return false;
}
/** 빌린 타일을 원래 줄에서 빼고 새 줄(이미 순서대로)을 놓는다 */
function take(table, set, borrowed) {
	for (const b of borrowed) b.set.splice(b.set.indexOf(b.tile), 1);
	table.push(set);
	return true;
}
//#endregion
//#region src/games/tiles/rules/turn.ts
const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
function checkPlay(opts) {
	const { oldTable, hand, newTable, melded } = opts;
	const onTable = new Set(oldTable.flat());
	const inHand = new Set(hand);
	const seen = /* @__PURE__ */ new Set();
	const placed = [];
	for (const id of newTable.flat()) {
		if (seen.has(id)) return {
			ok: false,
			problem: "bad-tiles"
		};
		seen.add(id);
		if (onTable.has(id)) continue;
		if (!inHand.has(id)) return {
			ok: false,
			problem: "bad-tiles"
		};
		placed.push(id);
	}
	if ([...onTable].some((id) => !seen.has(id))) return {
		ok: false,
		problem: "took-tile"
	};
	if (placed.length === 0) return {
		ok: false,
		problem: "nothing"
	};
	const sets = newTable.filter((s) => s.length > 0);
	if (sets.some((s) => !isValidSet(s))) return {
		ok: false,
		problem: "bad-set"
	};
	if (!melded) {
		const left = [...sets];
		for (const old of oldTable) {
			const i = left.findIndex((s) => sameSet(s, old));
			if (i < 0) return {
				ok: false,
				problem: "touched"
			};
			left.splice(i, 1);
		}
		if (left.some((s) => s.some((id) => onTable.has(id)))) return {
			ok: false,
			problem: "touched"
		};
		if (left.reduce((sum, s) => sum + setValue(s), 0) < 30) return {
			ok: false,
			problem: "too-small"
		};
	}
	return {
		ok: true,
		placed
	};
}
//#endregion
//#region src/games/tiles/play/engine.ts
function createEngine$2(opts) {
	const rng = createRng(opts.seed);
	const deck = shuffledDeck(rng);
	const hands = opts.players.map((_, i) => deck.slice(i * 13, (i + 1) * 13));
	return {
		now: opts.now,
		seed: rng.seed(),
		players: opts.players,
		teams: opts.teams ?? null,
		hands,
		pool: deck.slice(opts.players.length * 13),
		table: [],
		melded: opts.players.map(() => false),
		turn: Math.floor(rng.next() * opts.players.length),
		left: opts.players.map(() => false),
		stuck: 0,
		last: null,
		draft: null,
		botAt: null,
		botPlan: null,
		seq: 0,
		phase: {
			kind: "intro",
			until: opts.now + INTRO_MS$2
		}
	};
}
const within = (r, [min, max]) => min + r * (max - min);
const staying = (s) => s.left.flatMap((l, i) => l ? [] : [i]);
function startTurn(s, turn) {
	return {
		...s,
		turn,
		draft: null,
		botAt: null,
		botPlan: null,
		phase: {
			kind: "turn",
			until: s.now + TURN_MS$1
		}
	};
}
function nextTurn$1(s) {
	const n = s.players.length;
	for (let k = 1; k <= n; k++) {
		const t = (s.turn + k) % n;
		if (!s.left[t]) return startTurn(s, t);
	}
	return s;
}
const finish = (s) => ({
	...s,
	botAt: null,
	botPlan: null,
	phase: {
		kind: "done",
		until: s.now + DONE_MS$2
	}
});
function canAct(s, player) {
	return s.phase.kind === "turn" && s.turn === player;
}
function play(s, player, table) {
	if (!canAct(s, player)) return s;
	const check = checkPlay({
		oldTable: s.table,
		hand: s.hands[player],
		newTable: table,
		melded: s.melded[player]
	});
	if (!check.ok) return s;
	const hand = s.hands[player].filter((id) => !check.placed.includes(id));
	const seq = s.seq + 1;
	const next = {
		...s,
		seq,
		table: table.filter((set) => set.length > 0),
		hands: s.hands.map((h, i) => i === player ? hand : h),
		melded: s.melded.map((m, i) => m || i === player),
		stuck: 0,
		last: {
			player,
			kind: "play",
			placed: check.placed,
			seq
		}
	};
	return hand.length === 0 ? finish(next) : nextTurn$1(next);
}
function draw(s, player) {
	if (!canAct(s, player)) return s;
	const seq = s.seq + 1;
	if (s.pool.length === 0) {
		const next = {
			...s,
			seq,
			stuck: s.stuck + 1,
			last: {
				player,
				kind: "pass",
				placed: [],
				seq
			}
		};
		return next.stuck >= staying(next).length ? finish(next) : nextTurn$1(next);
	}
	const [tile, ...pool] = s.pool;
	return nextTurn$1({
		...s,
		seq,
		pool,
		hands: s.hands.map((h, i) => i === player ? [...h, tile] : h),
		stuck: 0,
		last: {
			player,
			kind: "draw",
			placed: [],
			seq,
			drawn: tile
		}
	});
}
/** 차례가 시작될 때의 번호 (짜던 바닥이 이번 차례 것인지 알아보려고) */
function turnSeqOf(s) {
	return s.last?.seq ?? 0;
}
function saveDraft(s, player, turnSeq, table) {
	if (!canAct(s, player) || turnSeq !== turnSeqOf(s)) return s;
	return {
		...s,
		draft: {
			player,
			turnSeq,
			table
		}
	};
}
/** 시간 초과: 짜던 바닥이 다 맞으면 그대로 내려놓고, 아니면(안 짰거나 틀림) 1장 가져오기 */
function timeUp(s, player) {
	if (s.draft && s.draft.player === player) {
		const next = play(s, player, s.draft.table);
		if (next !== s) return next;
	}
	return draw(s, player);
}
/** 처음 바닥에 없던(바뀐) 줄 */
function changedSets(from, to) {
	const old = new Set(from.map((set) => set.join(",")));
	return to.filter((set) => !old.has(set.join(",")));
}
/** 바뀐 줄을 앞에서 n개까지 놓은 중간 바닥: 거기 쓰인 타일은 원래 줄에서 뺀다 */
function partialTable(from, to, n) {
	const shown = changedSets(from, to).slice(0, n);
	const used = new Set(shown.flat());
	return [...from.map((set) => set.filter((id) => !used.has(id))).filter((set) => set.length > 0), ...shown];
}
/** 봇 차례: 생각 → 바뀐 줄을 하나씩 보여 줌 → 냄 (못 내면 1장) */
function botTick(s, p) {
	const { now } = s;
	if (s.botAt === null) {
		const rng = createRng(s.seed);
		return {
			...s,
			botAt: now + within(rng.next(), BOT_THINK_MS),
			seed: rng.seed()
		};
	}
	if (now < s.botAt) return s;
	if (!s.botPlan) {
		const table = chooseBotPlay(s.table, s.hands[p], s.melded[p]);
		const ok = table && checkPlay({
			oldTable: s.table,
			hand: s.hands[p],
			newTable: table,
			melded: s.melded[p]
		}).ok;
		if (!table || !ok) return draw(s, p);
		return {
			...s,
			botPlan: {
				table,
				shown: 0
			},
			botAt: now
		};
	}
	const { table, shown } = s.botPlan;
	if (shown >= changedSets(s.table, table).length) return play(s, p, table);
	const next = shown + 1;
	return {
		...s,
		botPlan: {
			table,
			shown: next
		},
		botAt: now + 700,
		draft: {
			player: p,
			turnSeq: turnSeqOf(s),
			table: partialTable(s.table, table, next)
		}
	};
}
function drop$1(s, player) {
	if (s.left[player] || s.phase.kind === "done") return s;
	const next = {
		...s,
		left: s.left.map((l, i) => l || i === player)
	};
	if (staying(next).length <= 1 || next.teams && lastTeam(next.left.map((l) => !l), next.teams) !== null) return finish(next);
	return s.turn === player && s.phase.kind === "turn" ? nextTurn$1(next) : next;
}
function tick$2(s) {
	const { phase, now } = s;
	switch (phase.kind) {
		case "intro": return now >= phase.until ? startTurn(s, s.turn) : s;
		case "turn": {
			const p = s.turn;
			if (s.players[p].kind === "bot") return botTick(s, p);
			return now >= phase.until ? timeUp(s, p) : s;
		}
		case "done": return s;
	}
}
function engineReducer$2(s, action) {
	switch (action.type) {
		case "tick": return tick$2({
			...s,
			now: action.now
		});
		case "play": return play(s, action.player, action.table);
		case "draw": return draw(s, action.player);
		case "draft": return saveDraft(s, action.player, action.turnSeq, action.table);
		case "drop": return drop$1(s, action.player);
	}
}
/**
* 순위: 손패를 다 턴 사람(또는 남은 점수가 가장 적은 사람)부터 남은 점수 적은 순, 같으면 장수 적은 순.
* 나간 사람은 맨 뒤
*/
function rankingOf(s) {
	return s.hands.map((_, i) => i).sort((a, b) => Number(s.left[a]) - Number(s.left[b]) || handValue(s.hands[a]) - handValue(s.hands[b]) || s.hands[a].length - s.hands[b].length || a - b);
}
/** 이긴 팀: 1등(손패를 다 턴 사람, 아니면 남은 점수가 가장 적은 사람)의 팀 */
function winnerTeam(s) {
	return s.teams ? s.teams[rankingOf(s)[0]] : null;
}
//#endregion
//#region src/games/tiles/play/view.ts
function toView$2(s) {
	return {
		players: s.players.map(({ id, name }) => ({
			id,
			name
		})),
		teams: s.teams,
		winTeam: s.phase.kind === "done" ? winnerTeam(s) : null,
		left: s.left,
		hands: s.hands,
		table: s.table,
		draft: s.phase.kind === "turn" && s.draft?.player === s.turn ? s.draft.table : null,
		melded: s.melded,
		poolCount: s.pool.length,
		turn: s.turn,
		phase: s.phase.kind,
		leftMs: Math.max(0, s.phase.until - s.now),
		last: s.last,
		ranking: s.phase.kind === "done" ? rankingOf(s) : null
	};
}
/** 친구에게 바로 알려야 할 만큼 바뀌었는지 (그 밖엔 1초마다 보냄) */
function viewChanged$1(a, b) {
	if (!a) return true;
	return a.phase !== b.phase || a.turn !== b.turn || a.last?.seq !== b.last?.seq || a.draft !== b.draft || a.left.some((x, i) => x !== b.left[i]);
}
//#endregion
//#region src/server/referees/tiles.ts
const hideFor = (v, key) => {
	if (v.phase === "done") return v;
	const me = v.players.findIndex((p) => p.id === key);
	return {
		...v,
		hands: v.hands.map((h, i) => i === me ? h : h.map(() => -1)),
		last: v.last && v.last.drawn !== void 0 && v.last.player !== me ? {
			...v.last,
			drawn: void 0
		} : v.last
	};
};
function tilesReferee(setup, ctx) {
	const o = setup ?? {};
	const players = readPlayers(o.players, ctx, 2, 4);
	if (!players) return null;
	const teams = readTeams(o.teams, players.length);
	if (teams === void 0) return null;
	return hostEngineReferee(ctx, {
		state: createEngine$2({
			now: ctx.now(),
			seed: serverSeed(),
			players,
			teams
		}),
		reduce: engineReducer$2,
		tick: (now) => ({
			type: "tick",
			now
		}),
		toView: toView$2,
		changed: viewChanged$1,
		viewFor: hideFor,
		input: (s, from, m) => {
			if (m.t !== "play" && m.t !== "draw" && m.t !== "draft") return void 0;
			const player = humanIndex(s.players, from);
			if (player < 0) return null;
			if (m.t === "draw") return {
				type: "draw",
				player
			};
			if (!isTable(m.table)) return null;
			if (m.t === "play") return {
				type: "play",
				player,
				table: m.table
			};
			return isInt(m.turnSeq, 0) ? {
				type: "draft",
				player,
				turnSeq: m.turnSeq,
				table: m.table
			} : null;
		},
		drop: (s, key) => {
			const player = humanIndex(s.players, key);
			return player >= 0 ? {
				type: "drop",
				player
			} : null;
		},
		done: (s) => s.phase.kind === "done",
		nowOf: (s) => s.now
	});
}
//#endregion
//#region src/games/wordchain/constants.ts
const INTRO_MS$1 = 2500;
/** 한 차례 (넘기면 탈락) */
const TURN_MS = 1e4;
const DONE_MS$1 = 2500;
//#endregion
//#region src/games/wordchain/play/engine.ts
function addLog(s, kind, player, text) {
	const seq = s.logSeq + 1;
	return {
		...s,
		logSeq: seq,
		log: [...s.log, {
			seq,
			kind,
			player,
			text
		}].slice(-30)
	};
}
const alive = (s) => s.players.flatMap((_, i) => s.left[i] || s.out.includes(i) ? [] : [i]);
function createEngine$1(opts) {
	const rng = createRng(opts.seed);
	const starters = WORDS.filter((w) => {
		if ([...w].length < 2 || [...w].length > 3) return false;
		const heads = initialVariants([...w].at(-1));
		return WORDS.filter((x) => x !== w && heads.includes([...x][0])).length >= 2;
	});
	const first = starters[Math.floor(rng.next() * starters.length)];
	const order = opts.players.map((_, i) => i);
	for (let i = order.length - 1; i > 0; i--) {
		const j = Math.floor(rng.next() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	return {
		now: opts.now,
		seed: rng.seed(),
		players: order.map((i) => opts.players[i]),
		left: opts.players.map(() => false),
		out: [],
		chain: [{
			word: first,
			player: null
		}],
		phase: {
			kind: "intro",
			until: opts.now + INTRO_MS$1
		},
		log: [],
		logSeq: 0
	};
}
/** 지금 단어가 시작해야 하는 글자들 (두음법칙 포함) */
function startsOf(s) {
	const last = s.chain.at(-1).word;
	return initialVariants([...last].at(-1));
}
/** from 다음 살아 있는 사람 (자리 순서) */
function nextAlive(s, from) {
	const n = s.players.length;
	for (let k = 1; k <= n; k++) {
		const i = (from + k) % n;
		if (!s.left[i] && !s.out.includes(i)) return i;
	}
	return null;
}
function turnOf(s, player) {
	return {
		...s,
		phase: {
			kind: "turn",
			player,
			until: s.now + TURN_MS,
			checking: null
		}
	};
}
function finishIfLast(s) {
	if (alive(s).length > 1) return null;
	return {
		...s,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$1
		}
	};
}
/** 형식·규칙 검사. 틀리면 이유 */
function checkWord(s, word) {
	const w = word.replace(/\s+/g, "");
	const chars = [...w];
	if (chars.length < 2) return "두 글자 이상만 돼요";
	if (chars.length > 10) return "너무 길어요";
	if (!chars.every(isSyllable)) return "한글 낱말만 돼요";
	if (!startsOf(s).includes(chars[0])) return `'${startsOf(s).join("' 또는 '")}'(으)로 시작해야 해요`;
	if (s.chain.some((l) => l.word === w)) return "이미 나온 낱말이에요";
	return null;
}
function tryWord(s, player, word) {
	const p = s.phase;
	if (p.kind !== "turn" || p.player !== player || p.checking) return s;
	const w = word.replace(/\s+/g, "").slice(0, 20);
	const bad = checkWord(s, w);
	if (bad) return addLog(s, "bad", player, `${w} — ${bad}`);
	return {
		...s,
		phase: {
			...p,
			checking: w
		}
	};
}
function accept(s, word) {
	const p = s.phase;
	if (p.kind !== "turn" || p.checking !== word) return s;
	const next = {
		...s,
		chain: [...s.chain, {
			word,
			player: p.player
		}]
	};
	const to = nextAlive(next, p.player);
	return to === null ? {
		...next,
		phase: {
			kind: "done",
			until: s.now + DONE_MS$1
		}
	} : turnOf(next, to);
}
function reject(s, word) {
	const p = s.phase;
	if (p.kind !== "turn" || p.checking !== word) return s;
	return addLog({
		...s,
		phase: {
			...p,
			checking: null
		}
	}, "bad", p.player, `${word} — 사전에 없어요`);
}
function eliminate(s, player, why) {
	const next = addLog({
		...s,
		out: [...s.out, player]
	}, "out", player, `${s.players[player].name} 탈락 (${why})`);
	const end = finishIfLast(next);
	if (end) return end;
	const p = s.phase;
	if (p.kind === "turn" && p.player === player) {
		const to = nextAlive(next, player);
		return to === null ? {
			...next,
			phase: {
				kind: "done",
				until: s.now + DONE_MS$1
			}
		} : turnOf(next, to);
	}
	return next;
}
function tick$1(s) {
	const { phase, now } = s;
	if (phase.kind === "intro") return now >= phase.until ? turnOf(s, 0) : s;
	if (phase.kind === "turn" && !phase.checking && now >= phase.until) return eliminate(s, phase.player, "시간 초과");
	return s;
}
function engineReducer$1(s, a) {
	switch (a.type) {
		case "tick": return tick$1({
			...s,
			now: a.now
		});
		case "try": return tryWord(s, a.player, a.word);
		case "accept": return accept(s, a.word);
		case "reject": return reject(s, a.word);
		case "drop": {
			if (s.left[a.player] || s.phase.kind === "done") return s;
			const marked = {
				...s,
				left: s.left.map((l, i) => l || i === a.player)
			};
			return s.out.includes(a.player) ? marked : eliminate(marked, a.player, "나감");
		}
	}
}
/** 순위: 남은 사람 1등, 늦게 탈락할수록 위 */
function ranksOf(s) {
	const n = s.players.length;
	return s.players.map((_, i) => {
		const k = s.out.indexOf(i);
		return k < 0 ? 1 : n - k;
	});
}
//#endregion
//#region src/games/wordchain/play/view.ts
function toView$1(s) {
	const p = s.phase;
	return {
		players: s.players.map(({ id, name }) => ({
			id,
			name
		})),
		left: s.left,
		out: s.out,
		phase: p.kind,
		leftMs: Math.max(0, p.until - s.now),
		turn: p.kind === "turn" ? p.player : null,
		checking: p.kind === "turn" ? p.checking : null,
		chain: s.chain.slice(-12),
		count: s.chain.length - 1,
		starts: startsOf(s),
		log: s.log.slice(-6),
		ranks: ranksOf(s)
	};
}
function changeKey(s) {
	const p = s.phase;
	return [
		p.kind,
		s.chain.length,
		s.logSeq,
		s.out.join(),
		s.left.join(),
		p.kind === "turn" ? `${p.player}.${p.checking}` : ""
	].join("|");
}
//#endregion
//#region src/server/dict.ts
const env = globalThis.process?.env ?? {};
const cache = /* @__PURE__ */ new Map();
async function isNoun(word) {
	const key = env.STDICT_KEY;
	if (!key) return null;
	const hit = cache.get(word);
	if (hit !== void 0) return hit;
	try {
		const url = `https://stdict.korean.go.kr/api/search.do?key=${encodeURIComponent(key)}&q=${encodeURIComponent(word)}&req_type=json&type_search=search&advanced=y&method=exact&pos=1&num=10`;
		const ctl = new AbortController();
		const timer = setTimeout(() => ctl.abort(), 3e3);
		const res = await fetch(url, { signal: ctl.signal });
		clearTimeout(timer);
		if (!res.ok) return null;
		const text = (await res.text()).trim();
		if (!text) return remember(word, false);
		const json = JSON.parse(text);
		if (json.error) return null;
		return remember(word, Number(json.channel?.total ?? 0) > 0);
	} catch {
		return null;
	}
}
function remember(word, ok) {
	if (cache.size > 2e4) cache.clear();
	cache.set(word, ok);
	return ok;
}
//#endregion
//#region src/server/referees/wordchain.ts
function wordchainReferee(setup, ctx) {
	const players = readPlayers((setup ?? {}).players, ctx, 2, 8);
	if (!players || players.some((p) => p.kind === "bot")) return null;
	return hostEngineReferee(ctx, {
		state: createEngine$1({
			now: ctx.now(),
			seed: serverSeed(),
			players
		}),
		reduce: engineReducer$1,
		tick: (now) => ({
			type: "tick",
			now
		}),
		toView: (s) => s,
		changed: (a, b) => !a || changeKey(a) !== changeKey(b),
		wrap: (s) => ({
			t: "view",
			v: toView$1(s)
		}),
		input: (s, from, m, later) => {
			if (m.t !== "say") return void 0;
			const player = s.players.findIndex((p) => p.id === from);
			if (player < 0 || typeof m.word !== "string" || m.word.length > 40) return null;
			const after = engineReducer$1(s, {
				type: "try",
				player,
				word: m.word
			});
			if (after.phase.kind === "turn" && after.phase.checking && !(s.phase.kind === "turn" && s.phase.checking)) {
				const word = after.phase.checking;
				isNoun(word).then((ok) => later(ok === false ? {
					type: "reject",
					word
				} : {
					type: "accept",
					word
				}));
			}
			return {
				type: "try",
				player,
				word: m.word
			};
		},
		drop: (s, key) => {
			const player = s.players.findIndex((p) => p.id === key);
			return player >= 0 ? {
				type: "drop",
				player
			} : null;
		},
		done: (s) => s.phase.kind === "done",
		nowOf: (s) => s.now
	});
}
//#endregion
//#region src/games/yut/rules/board.ts
/** 길마다 지나가는 칸. 마지막 칸(0)이 '끝'이고, 넘어가면 나간다 */
const ROUTES = {
	outer: [
		0,
		1,
		2,
		3,
		4,
		5,
		6,
		7,
		8,
		9,
		10,
		11,
		12,
		13,
		14,
		15,
		16,
		17,
		18,
		19,
		0
	],
	r5: [
		5,
		20,
		21,
		22,
		23,
		24,
		15,
		16,
		17,
		18,
		19,
		0
	],
	r10: [
		10,
		25,
		26,
		22,
		27,
		28,
		0
	],
	rc: [
		22,
		27,
		28,
		0
	]
};
const nodeOf = (p) => ROUTES[p.route][p.idx];
/** 멈춘 칸이 꺾이는 칸이면 그 지름길로 갈아탄다 */
function settle(p) {
	const node = nodeOf(p);
	if (p.route === "outer" && node === 5) return {
		route: "r5",
		idx: 0
	};
	if (p.route === "outer" && node === 10) return {
		route: "r10",
		idx: 0
	};
	if (p.route === "r5" && node === 22) return {
		route: "rc",
		idx: 0
	};
	return p;
}
/** 처음 판에 올리며 steps칸 (빽도는 못 함) */
function enter(steps) {
	return settle({
		route: "outer",
		idx: steps
	});
}
/** 앞으로 steps칸. 끝을 넘어가면 'out'(나감) */
function advance(p, steps) {
	const idx = p.idx + steps;
	if (idx >= ROUTES[p.route].length) return "out";
	return settle({
		route: p.route,
		idx
	});
}
/** 한 칸 뒤로 (빽도). 지름길 첫 칸에서는 들어온 길로 돌아간다 */
function back(p) {
	if (p.idx > 0) {
		if (p.route === "outer" && p.idx === 1) return {
			route: "outer",
			idx: ROUTES.outer.length - 1
		};
		return settle({
			route: p.route,
			idx: p.idx - 1
		});
	}
	switch (p.route) {
		case "r5": return {
			route: "outer",
			idx: 4
		};
		case "r10": return {
			route: "outer",
			idx: 9
		};
		case "rc": return {
			route: "r5",
			idx: 2
		};
		case "outer": return p;
	}
}
/** 남은 거리 (봇이 누가 앞서는지 볼 때) */
function distanceLeft(p) {
	return ROUTES[p.route].length - p.idx;
}
(() => {
	const xy = {};
	const lo = 30;
	const hi = 270;
	const step = 48;
	for (let k = 0; k <= 5; k++) {
		xy[k] = [hi, hi - k * step];
		xy[5 + k] = [hi - k * step, lo];
		xy[10 + k] = [lo, lo + k * step];
		if (k < 5) xy[15 + k] = [lo + k * step, hi];
	}
	const mid = 150;
	const along = (a, t) => [a[0] + (mid - a[0]) * t, a[1] + (mid - a[1]) * t];
	xy[20] = along(xy[5], 1 / 3);
	xy[21] = along(xy[5], 2 / 3);
	xy[22] = [mid, mid];
	xy[23] = along(xy[15], 2 / 3);
	xy[24] = along(xy[15], 1 / 3);
	xy[25] = along(xy[10], 1 / 3);
	xy[26] = along(xy[10], 2 / 3);
	xy[27] = along(xy[0], 2 / 3);
	xy[28] = along(xy[0], 1 / 3);
	return xy;
})();
//#endregion
//#region src/games/yut/rules/throw.ts
/** 움직이는 칸 수 (빽도 = 뒤로 한 칸) */
const STEPS = {
	backdo: -1,
	do: 1,
	gae: 2,
	geol: 3,
	yut: 4,
	mo: 5
};
/** 16번 중 몇 번 */
const THROW_WEIGHTS = {
	backdo: 1,
	do: 3,
	gae: 6,
	geol: 4,
	yut: 1,
	mo: 1
};
function throwYut(rng) {
	return pickWeighted(rng, THROW_WEIGHTS);
}
/** 나오면 한 번 더 던지는 결과 */
const isBonus = (t) => t === "yut" || t === "mo";
//#endregion
//#region src/games/yut/rules/moves.ts
const onBoard$1 = (p) => p !== "home" && p !== "out";
/** 내 말이 있는 칸들 (업힌 말은 한 번만) */
function groupsOf(mine) {
	return [...new Set(mine.filter(onBoard$1).map(nodeOf))];
}
/** 한 결과로 갈 수 있는 곳 */
function destOf(mine, from, t) {
	if (from === "home") {
		if (t === "backdo" || !mine.includes("home")) return null;
		return enter(STEPS[t]);
	}
	const p = mine.find((x) => onBoard$1(x) && nodeOf(x) === from);
	if (!p) return null;
	return t === "backdo" ? back(p) : advance(p, STEPS[t]);
}
/** 지금 쓸 수 있는 움직임 전부. 같은 결과가 여러 개면 첫 번째만 */
function movesFor(pieces, player, pending) {
	const mine = pieces[player];
	const froms = [...groupsOf(mine), ...mine.includes("home") ? ["home"] : []];
	const moves = [];
	pending.forEach((t, throwIdx) => {
		if (pending.indexOf(t) !== throwIdx) return;
		for (const from of froms) {
			const to = destOf(mine, from, t);
			if (to !== null) moves.push({
				throwIdx,
				from,
				to
			});
		}
	});
	return moves;
}
/** 움직임을 판에 적용. 업기(같은 칸 내 말과 합침)·잡기(상대 말 처음으로) */
function applyMove(pieces, player, t, from, to) {
	const next = pieces.map((row) => [...row]);
	const mine = next[player];
	const moving = from === "home" ? [mine.indexOf("home")] : mine.flatMap((p, i) => onBoard$1(p) && nodeOf(p) === from ? [i] : []);
	for (const i of moving) mine[i] = to;
	let captured = 0;
	if (to !== "out") {
		const node = nodeOf(to);
		mine.forEach((p, i) => {
			if (onBoard$1(p) && nodeOf(p) === node) mine[i] = to;
		});
		next.forEach((row, other) => {
			if (other === player) return;
			row.forEach((p, i) => {
				if (onBoard$1(p) && nodeOf(p) === node) {
					row[i] = "home";
					captured++;
				}
			});
		});
	}
	return {
		pieces: next,
		captured,
		bonus: captured > 0 && !isBonus(t)
	};
}
/** 다 나갔는지 */
const allOut = (mine) => mine.every((p) => p === "out");
//#endregion
//#region src/games/yut/bot/yutBot.ts
const onBoard = (p) => typeof p === "object" && p !== null;
/** 상대 말이 한 번에 올 수 있는 칸들 */
function threatened(pieces, player) {
	const nodes = /* @__PURE__ */ new Set();
	pieces.forEach((row, other) => {
		if (other === player) return;
		for (const p of row) {
			if (!onBoard(p)) continue;
			for (let steps = 1; steps <= 5; steps++) {
				const to = advance(p, steps);
				if (to !== "out") nodes.add(nodeOf(to));
			}
		}
	});
	return nodes;
}
function score(pieces, player, pending, m) {
	const t = pending[m.throwIdx];
	const mine = pieces[player];
	const group = m.from === "home" ? 1 : mine.filter((p) => onBoard(p) && nodeOf(p) === m.from).length;
	const before = m.from === "home" ? 21 : distanceLeft(mine.find((p) => onBoard(p) && nodeOf(p) === m.from));
	if (m.to === "out") return 1e3 + group * 50;
	const { pieces: after, captured, bonus } = applyMove(pieces, player, t, m.from, m.to);
	let s = (before - distanceLeft(m.to)) * 3 * group;
	s += captured * 120 + (bonus ? 40 : 0);
	const node = nodeOf(m.to);
	const stacked = after[player].filter((p) => onBoard(p) && nodeOf(p) === node).length;
	if (stacked > group) s += 15;
	if (threatened(after, player).has(node)) s -= 25 * stacked;
	return s;
}
function chooseBotMove(rng, pieces, player, pending) {
	const moves = movesFor(pieces, player, pending);
	if (moves.length === 0) return null;
	let best = [];
	let bestScore = -Infinity;
	for (const m of moves) {
		const s = score(pieces, player, pending, m);
		if (s > bestScore) {
			bestScore = s;
			best = [m];
		} else if (s === bestScore) best.push(m);
	}
	return best[Math.floor(rng.next() * best.length)];
}
//#endregion
//#region src/games/yut/constants.ts
/** 첫 차례 전 안내 */
const INTRO_MS = 1800;
/** 던질지·무엇을 옮길지 고르는 시간. 넘기면 저절로 */
const DECIDE_MS = 2e4;
/** 경기가 끝난 뒤 결과 화면으로 넘어가기까지 */
const DONE_MS = 2500;
//#endregion
//#region src/games/yut/play/engine.ts
function createEngine(opts) {
	const rng = createRng(opts.seed);
	const first = Math.floor(rng.next() * opts.players.length);
	return {
		now: opts.now,
		seed: rng.seed(),
		players: opts.players,
		teams: opts.teams ?? null,
		pieces: (opts.teams ? [0, 1] : opts.players).map(() => Array.from({ length: opts.pieceCount }, () => "home")),
		turn: first,
		pending: [],
		throwsLeft: 1,
		lockUntil: 0,
		lastThrow: null,
		lastMove: null,
		left: opts.players.map(() => false),
		botAt: null,
		seq: 0,
		phase: {
			kind: "intro",
			until: opts.now + INTRO_MS
		}
	};
}
/** 이 사람이 움직이는 말 줄 (팀전이면 팀, 아니면 자기) */
const ownerOf = (teams, player) => teams ? teams[player] : player;
/** 지금 이 사람이 던질 수 있는지 */
function canThrow(s, player) {
	return s.phase.kind === "turn" && s.turn === player && s.throwsLeft > 0 && s.now >= s.lockUntil;
}
/** 지금 이 사람이 말을 옮길 수 있는지 (던질 게 남아 있으면 먼저 던져야 함) */
function canMove(s, player) {
	return s.phase.kind === "turn" && s.turn === player && s.throwsLeft === 0 && s.now >= s.lockUntil;
}
function decide(s) {
	return {
		...s,
		botAt: null,
		phase: {
			kind: "turn",
			until: s.now + DECIDE_MS
		}
	};
}
/** 쓸 수 없는 결과는 버리고, 다 썼으면 다음 사람 */
function tidy(s) {
	if (s.phase.kind !== "turn" || s.throwsLeft > 0) return s;
	let pending = s.pending;
	if (movesFor(s.pieces, ownerOf(s.teams, s.turn), pending).length === 0) pending = [];
	if (pending.length > 0) return {
		...s,
		pending
	};
	return nextTurn({
		...s,
		pending
	});
}
function nextTurn(s) {
	const n = s.players.length;
	let turn = s.turn;
	for (let k = 1; k <= n; k++) {
		const t = (s.turn + k) % n;
		if (!s.left[t]) {
			turn = t;
			break;
		}
	}
	return decide({
		...s,
		turn,
		pending: [],
		throwsLeft: 1
	});
}
function doThrow(s, player) {
	if (!canThrow(s, player)) return s;
	const rng = createRng(s.seed);
	const result = throwYut(rng);
	const seq = s.seq + 1;
	return tidy(decide({
		...s,
		seed: rng.seed(),
		seq,
		pending: [...s.pending, result],
		throwsLeft: s.throwsLeft - 1 + (isBonus(result) ? 1 : 0),
		lockUntil: s.now + 700,
		lastThrow: {
			player,
			result,
			seq
		}
	}));
}
function doMove(s, player, throwIdx, from) {
	if (!canMove(s, player)) return s;
	const own = ownerOf(s.teams, player);
	const move = movesFor(s.pieces, own, s.pending).find((m) => m.throwIdx === throwIdx && m.from === from);
	if (!move) return s;
	const t = s.pending[throwIdx];
	const { pieces, captured, bonus } = applyMove(s.pieces, own, t, from, move.to);
	const seq = s.seq + 1;
	const next = {
		...s,
		seq,
		pieces,
		pending: s.pending.filter((_, i) => i !== throwIdx),
		throwsLeft: bonus ? 1 : 0,
		lastMove: {
			player,
			from,
			to: move.to === "out" ? "out" : nodeOf(move.to),
			captured,
			seq
		}
	};
	if (allOut(pieces[own])) return {
		...next,
		pending: [],
		phase: {
			kind: "done",
			winner: player,
			until: s.now + DONE_MS
		}
	};
	return tidy(decide(next));
}
/** 봇·시간 초과: 던질 게 있으면 던지고, 아니면 봇처럼 고른다 */
function auto(s) {
	if (s.throwsLeft > 0) return doThrow(s, s.turn);
	const rng = createRng(s.seed);
	const m = chooseBotMove(rng, s.pieces, ownerOf(s.teams, s.turn), s.pending);
	const next = {
		...s,
		seed: rng.seed()
	};
	return m ? doMove(next, s.turn, m.throwIdx, m.from) : tidy(next);
}
function drop(s, player) {
	if (s.left[player] || s.phase.kind === "done") return s;
	const left = s.left.map((l, i) => l || i === player);
	const pieces = s.teams ? s.pieces : s.pieces.map((row, i) => i === player ? row.map(() => "home") : row);
	const stay = left.flatMap((l, i) => l ? [] : [i]);
	if (stay.length === 1 || s.teams && lastTeam(left.map((l) => !l), s.teams) !== null) return {
		...s,
		left,
		pieces,
		phase: {
			kind: "done",
			winner: stay[0],
			until: s.now + DONE_MS
		}
	};
	const next = {
		...s,
		left,
		pieces
	};
	return s.turn === player ? nextTurn(next) : next;
}
function tick(s) {
	const { phase, now } = s;
	switch (phase.kind) {
		case "intro": return now >= phase.until ? decide(s) : s;
		case "turn":
			if (now < s.lockUntil) return s;
			if (s.players[s.turn].kind === "bot") {
				if (s.botAt === null) return {
					...s,
					botAt: now + 800
				};
				return now >= s.botAt ? auto({
					...s,
					botAt: null
				}) : s;
			}
			return now >= phase.until ? auto(s) : s;
		case "done": return s;
	}
}
function engineReducer(s, action) {
	switch (action.type) {
		case "tick": return tick({
			...s,
			now: action.now
		});
		case "throw": return doThrow(s, action.player);
		case "move": return doMove(s, action.player, action.throwIdx, action.from);
		case "drop": return drop(s, action.player);
	}
}
//#endregion
//#region src/games/yut/play/view.ts
function toView(s) {
	return {
		players: s.players.map(({ id, name, avatar }) => ({
			id,
			name,
			...avatar ? { avatar } : {}
		})),
		teams: s.teams,
		left: s.left,
		pieces: s.pieces,
		turn: s.turn,
		pending: s.pending,
		throwsLeft: s.throwsLeft,
		phase: s.phase.kind,
		leftMs: Math.max(0, s.phase.until - s.now),
		lockMs: Math.max(0, s.lockUntil - s.now),
		lastThrow: s.lastThrow,
		lastMove: s.lastMove,
		winner: s.phase.kind === "done" ? s.phase.winner : null
	};
}
/** 친구에게 바로 알려야 할 만큼 바뀌었는지 (그 밖엔 1초마다 보냄) */
function viewChanged(a, b) {
	if (!a) return true;
	return a.phase !== b.phase || a.turn !== b.turn || a.throwsLeft !== b.throwsLeft || a.pending.length !== b.pending.length || a.lastThrow?.seq !== b.lastThrow?.seq || a.lastMove?.seq !== b.lastMove?.seq || a.left.some((x, i) => x !== b.left[i]);
}
//#endregion
//#region src/server/referees/yut.ts
function yutReferee(setup, ctx) {
	const o = setup ?? {};
	const players = readPlayers(o.players, ctx, 2, 4);
	if (!players) return null;
	const teams = readTeams(o.teams, players.length);
	if (teams === void 0 || !isInt(o.pieceCount, 2, 4)) return null;
	return hostEngineReferee(ctx, {
		state: createEngine({
			now: ctx.now(),
			seed: serverSeed(),
			players,
			teams,
			pieceCount: o.pieceCount
		}),
		reduce: engineReducer,
		tick: (now) => ({
			type: "tick",
			now
		}),
		toView,
		changed: viewChanged,
		input: (s, from, m) => {
			if (m.t !== "throw" && m.t !== "move") return void 0;
			const player = humanIndex(s.players, from);
			if (player < 0) return null;
			if (m.t === "throw") return {
				type: "throw",
				player
			};
			const piece = m.piece === "home" ? "home" : isInt(m.piece, 0, 100) ? m.piece : null;
			return piece !== null && isInt(m.throwIdx, 0, 30) ? {
				type: "move",
				player,
				throwIdx: m.throwIdx,
				from: piece
			} : null;
		},
		drop: (s, key) => {
			const player = humanIndex(s.players, key);
			return player >= 0 ? {
				type: "drop",
				player
			} : null;
		},
		done: (s) => s.phase.kind === "done",
		nowOf: (s) => s.now
	});
}
//#endregion
//#region src/server/referees/index.ts
const REFEREES = {
	roulette: rouletteReferee,
	bomb: bombReferee,
	nunchi: nunchiReferee,
	survival: survivalReferee,
	yut: yutReferee,
	tiles: tilesReferee,
	artillery: artilleryReferee,
	numbaseball: numbaseballReferee,
	memory: memoryReferee,
	fight: fightReferee,
	omok: omokReferee,
	doodle: doodleReferee,
	chosung: chosungReferee,
	wordchain: wordchainReferee,
	armwrestle: armwrestleReferee
};
//#endregion
//#region game-server/main.ts
const PORT = Number(process.env.PORT ?? 8090);
const SUPABASE_URL = "https://fxekefrjsmnmcuoaynfa.supabase.co";
/** 같은 토큰은 한동안 다시 안 묻는다 */
const verified = /* @__PURE__ */ new Map();
async function verify(token, apikey) {
	const hit = verified.get(token);
	if (hit && hit.until > Date.now()) return hit.uid;
	try {
		const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: {
			authorization: `Bearer ${token}`,
			apikey
		} });
		if (!res.ok) return null;
		const user = await res.json();
		if (typeof user.id !== "string") return null;
		if (verified.size > 5e3) verified.clear();
		verified.set(token, {
			uid: user.id,
			until: Date.now() + 6e5
		});
		return user.id;
	} catch {
		return null;
	}
}
const hub = new Hub({
	verify,
	graceMs: 15e3,
	referees: REFEREES
});
setInterval(() => hub.sweep(), 6e5);
const ALLOWED_ORIGIN = /^https:\/\/mins-game[a-z0-9-]*\.vercel\.app$|^http:\/\/localhost:\d+$/;
const http = createServer((req, res) => {
	res.writeHead(200, { "content-type": "text/plain" });
	res.end(req.url === "/stats" ? JSON.stringify(hub.stats()) : "OK");
});
new import_websocket_server.default({
	server: http,
	maxPayload: 32768,
	verifyClient: ({ origin }) => ALLOWED_ORIGIN.test(origin ?? "")
}).on("connection", (ws) => {
	const session = hub.open({
		send: (t) => ws.send(t),
		close: (code) => ws.close(code)
	});
	let alive = true;
	ws.on("pong", () => alive = true);
	const beat = setInterval(() => {
		if (!alive) return ws.terminate();
		alive = false;
		ws.ping();
	}, 2e4);
	ws.on("message", (data) => session.receive(data.toString()));
	ws.on("close", () => {
		clearInterval(beat);
		session.close();
	});
	ws.on("error", () => ws.terminate());
});
http.listen(PORT, () => console.log(`[game] ${PORT}번에서 기다리는 중`));
//#endregion
export {};
