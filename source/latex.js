/**
Copyright 2017 ToManage

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

@author    ToManage SAS <contact@tomanage.fr>
@copyright 2014-2017 ToManage SAS
@license   http://www.apache.org/licenses/LICENSE-2.0 Apache License, Version 2.0
International Registered Trademark & Property of ToManage SAS
*/



"use strict";
var mongoose = require('mongoose'),
		fs = require("fs"),
		path = require("path"),
		accounting = require("accounting"),
		exec = require("child_process").exec,
		util = require('util'),
		async = require('async'),
		events = require('events'),
		moment = require('moment'),
		i18n = require('i18next'),
		shortId = require('shortid'),
		_ = require('lodash');

var Dict = require('./dict');

var latex = {
		models: F.path.root() + "/latex/",
		includes: F.path.root() + "/latex/texpackages/"
};

/**
 * Latex pipe convertion with a pipe
 */
/*
 template(doc)
 .apply(values)
 .on('error', function(err){
 throw err;
 })
 .finalize(function(bytes){
 console.log('The document is ' + bytes + ' bytes large.');
 })
 .pipe(createWriteStream('mydocument.odt'))
 .on('close', function(){
 console.log('document written');
 });
 */

exports.Template = createTemplate;
/**
 * Simply instantiates a new template instance.
 *
 * @param {String|Stream} arg The file path or stream with the odt data.
 */

function createTemplate(path, entity, options) {
		return new Template(path, entity, options);
}

/**
 * Class to work with odf templates.
 *
 * @param {String|Stream} arg The file path or stream with the tex data.
 */

function Template(arg, entity, options) {
		this.handlers = []; // variables
		this.entity = entity;

		if (typeof options !== 'object')
				this.options = {};
		else
				this.options = options;
		// the constructor now works with a stream, too
		if (arg)
				this.stream = fs.createReadStream(latex.models + arg);
}

// inherit from event emitter

util.inherits(Template, events.EventEmitter);
/**
 * Applies the values to the template and emits an `end` event.
 *
 * @param {Object} values The values to apply to the document.
 * @emit end {Archive} The read stream of the finished document.
 */

Template.prototype.apply = function(handler) {

		// provide a shortcut for simple value applying and convert to array
		this.handlers = _.values(_.reduce(handler, function(result, num, key) {
				num.id = key;
				result[key] = num;
				return result;
		}, {}));
		//console.log(this.handlers);

		// if the template is already running the action is complete

		if (this.processing)
				return this;
		// we have to wait for the number of entries.  they might be resolved in an
		// asynchronous way

		return apply.call(this);

		function apply() {

				// parse the tex file
				this
						.stream
						.on('data', this.processContent.bind(this));
				// the blip needs a resume to work properly
				this.processing = true;
				return this;
		}
};
/**
 * Parses the content and applies the handlers.
 *
 * @param {Stream} stream The to the content.
 * @api private
 */

Template.prototype.processContent = function(stream) {
		var emit = this.emit.bind(this);
		var self = this;
		async.waterfall(
				[
						parse(stream),
						this.applyHandlers(),
						this.applyHeadFoot()
						//this.append({name: 'content.xml'})
				],
				function(err, result) {
						// result now equals 'done'

						if (err)
								return emit('error', err);
						emit('finalized', result);
						emit('compile', result);
				});
};
/**
 * Apply the content to the various installed handlers.
 *
 * @return {Function} function(content, done).
 * @api private
 */

Template.prototype.applyHandlers = function() {
		var handlers = this.handlers;
		const self = this;
		var json = {};

		function apply(handler, key, callback) {
				var value = "";

				switch (handler.type) {

						case "date":
								if (handler.value)
										value = moment(handler.value).format(handler.format);

								break;

						default:
								if (handler.value)
										value = handler.value;
				}

				return callback(null, key, value);

		}

		return function(content, done) {
				//console.log(content);

				content = content.replace(new RegExp("--LINES--", "g"), null || "lines"); // TODO need replace null !

				async.eachSeries(
						handlers,
						function(handler, next) {
								// apply the handlers to the content
								//console.log(handler);

								if (_.isArray(handler.value)) {
										//if (!handler.value[0] || !handler.value[0].keys)
										//		return next("Array(0) row keys is missing " + handler.id);
										//var columns = handler.value[0].keys;
										json[handler.id] = handler.value;
										return next();

										/*async.eachSeries(handler.value, function(tabline, cb) {
												if (tabline.keys)
														return cb();

														var output = {};

												// Add horizontal line
												//console.log(tabline);
												if (tabline.hline) {
														//output += "\\hline\n";
														output.isHline = true;
														return cb();
												}

												for (var i = 0; i < columns.length; i++) {
														//console.log(tabline);
														if (typeof tabline[columns[i].key] === 'undefined')
																return next("Value not found in array : " + handler.id + " for key " + columns[i].key);


														if (columns[i].type === 'area') // Specific for array multilines
																tabline[columns[i].key] = "\\specialcell[t]{" + tabline[columns[i].key] + "\\\\}";

														apply(_.extend(columns[i], {
																value: tabline[columns[i].key]
														}), i, function(err, key, value) {
																if (err)
																		return next(err);

																//if (tabline.italic)
																//		output += '\\textit{' + value + '}';
																//else
																		output[columns[i].key] = {
																			value : value,
																			isItalic : tabline.italic
																		};

																//console.log(key);
																if (key === columns.length - 1) { // end line
																	json[handler.id].push(output);
																//		output += "\\tabularnewline\n";
																		cb();
																	}
																//} else
																//		output += "&"; //next column

														});
												}

										}, function() {
												//console.log(output);
												let model = "";
												//output = model.replace(new RegExp("--DATA--", "g"), output);

												next();
										});*/
								} else {
										apply(handler, handler.id, function(err, key, value) {
												if (err)
														return next(err);

												json[key] = {
														value: value
												};

												//content = content.replace(new RegExp("--" + key + "--", "g"), value);
												next();
										})
								}
						},
						function(err) {
								if (err)
										return done(err);

								function deepMap(obj, cb) {

										Object.keys(obj).forEach(function(k) {
												var val;

												if (obj[k] !== null && typeof obj[k] === 'object') {
														val = deepMap(obj[k], cb);
												} else {
														val = cb(obj[k], k);
												}

												obj[k] = val;
										});

										return obj;
								}

								json = deepMap(json, function(v, k) {
										if (typeof v !== "string")
												return v;

										return v.replace(/_/gi, "\\_")
												.replace(/%/gi, "\\%")
												.replace(/&/gi, "\\&")
												.replace(/\n/g, "\\\\");
								});

								self.on('json', function(dirPath) {
										fs.writeFile(path.join(dirPath, "data.json"), JSON.stringify(json), function(err) {
												if (err)
														emit('error', err);
										});
								});

								done(null, content);
						}
				);
		};
};
/**
 * Apply the head and foot to the various.
 *
 * @return {Function} function(content, done).
 * @api private
 */

Template.prototype.applyHeadFoot = function() {
		var entity = this.entity;
		var cgv = this.options.cgv;
		const emit = this.emit.bind(this);
		const EntityModel = MODEL('entity').Schema;



		return function(tex, done) {
				Dict.dict({
						dictName: "fk_forme_juridique",
						object: true
				}, function(err, dict) {

						EntityModel.findOne({
								_id: entity
						}, function(err, doc) {
								if (err || !doc)
										return emit("error", "Entity not found");
								var mysoc = "";
								mysoc = "\\textbf{\\large " + doc.name + "}\\\\" + doc.address.street.replace(/\n/g, "\\\\") + "\\\\" + doc.address.zip + " " + doc.address.city;
								if (doc.phones.phone)
										mysoc += "\\\\Tel : " + doc.phones.phone;
								if (doc.phones.fax)
										mysoc += "\\\\ Fax : " + doc.phones.fax;
								if (doc.emails.length)
										mysoc += "\\\\ Email : " + doc.emails[0].email;
								if (doc.companyInfo.idprof6)
										mysoc += "\\\\ TVA Intra. : " + doc.companyInfo.idprof6;

								tex = tex.replace(/--MYSOC--/g, mysoc);

								tex = tex.replace(/--MYSOC.NAME--/g, doc.name || "");
								tex = tex.replace(/--MYSOC.ADDRESS--/g, doc.address.street.replace(/\n/g, " - ") || "");
								tex = tex.replace(/--MYSOC.ZIP--/g, doc.address.zip || "");
								tex = tex.replace(/--MYSOC.TOWN--/g, doc.address.city || "");
								tex = tex.replace(/--MYSOC.PHONE--/g, doc.phones.phone || "");
								tex = tex.replace(/--MYSOC.FAX--/g, doc.phones.fax || "");
								tex = tex.replace(/--MYSOC.EMAIL--/g, doc.emails[0].email || "");
								tex = tex.replace(/--MYSOC.TVA--/g, doc.companyInfo.idprof6 || "");


								var foot = "";
								foot = "\\textsc{" + doc.name + "} - " + doc.companyInfo.idprof2 + " - NAF : " + doc.companyInfo.idprof3;
								if (doc.companyInfo.idprof1)
										foot += " - " + doc.companyInfo.idprof4;
								foot += " - " + doc.address.street + " " + doc.address.zip + " " + doc.address.city;
								foot += " - " + dict.values[doc.companyInfo.forme_juridique_code].label + " - capital " + doc.companyInfo.capital + " euros";

								if (doc.langs.length && doc.langs[0].invoiceFoot)
										foot += "\\\\" + doc.langs[0].invoiceFoot;

								tex = tex.replace(/--FOOT--/g, foot);
								tex = tex.replace(/--VATMODE--/g, i18n.t("orders:VATmode." + doc.tva_mode));
								tex = tex.replace(/--ENTITY--/g, "\\textbf{" + doc.name + "}");
								if (doc.iban && doc.iban.id)
										tex = tex.replace(/--IBAN--/g, doc.iban.bank + "\\\\ IBAN : " + doc.iban.id + "\\\\ BIC : " + doc.iban.bic);
								else
										tex = tex.replace(/--IBAN--/g, "RIB/IBAN sur demande.");
								tex = tex.replace(/--LOGO--/g, doc.logo);
								tex = tex.replace(/é/g, "\\'e");
								tex = tex.replace(/è/g, "\\`e");

								if (doc.cgv && cgv)
										tex += "\n" + "\\input{" + doc.cgv.split(".")[0] + "}";

								done(null, tex);
						});
				});
		};
};
/**
 * Register a handler on the 'finalized' event.  This was formerly needed to
 * launch the finalization of the archive.  But this is done automatically now.
 */

Template.prototype.finalize = function(done) {
		this.on('finalized', done);
		return this;
};

/**
 * Register a handler on the 'finalized' event. This start latex compilation
 */

Template.prototype.compile = function(layout, inputTex) {

		if (typeof layout === 'undefined') // Choose an other model latex
				layout = "main"; // .tex .log ...

		var emit = this.emit.bind(this);

		var compile = function(tex) {
				// make temporary directory to create and compile latex pdf
				var dirPath = F.path.temp() + "pdfcreator-" + shortId.generate();

				fs.mkdirSync(dirPath);
				emit('json', dirPath);

				var inputPath = path.join(dirPath, "main.tex");
				var compilePath = path.join(dirPath, layout + ".tex");
				var afterCompile = function(err) {
						// store the logs for the user here
						fs.readFile(path.join(dirPath, layout + ".log"), function(err, data) {
								if (err) {
										return emit('error', "Error while trying to read logs.");
								}

								var pdfTitle = layout + ".pdf",
										tempfile = path.join(dirPath, pdfTitle);
								var outputStream = fs.createReadStream(tempfile);
								emit('pipe', outputStream);
								outputStream.on('end', function() {
										deleteFolderRecursive(dirPath);
										emit('end');
								});
								return;
						});
				};
				fs.writeFile(inputPath, tex, function(err) {
						if (err) {
								console.log(err);
								return emit('error', "An error occured even before compiling");
						}
						//process.chdir(dirPath);
						var copyPackages = ["cp -r", latex.includes + ".", dirPath + "/"].join(" ");
						exec(copyPackages, function(err) {
								if (err) {
										console.log(err);
										return emit('error', "Error copying additional " + "packages/images to use during compilation");
								}

								// compile the document (or at least try)
								exec("cd " + dirPath + " && TEXINPUTS=" + dirPath + ":$TEXINPUTS lualatex -interaction=nonstopmode -output-directory=" + dirPath + " " + compilePath + " > /dev/null 2>&1", function() {
										exec("cd " + dirPath + " && TEXINPUTS=" + dirPath + ":$TEXINPUTS lualatex -interaction=nonstopmode -output-directory=" + dirPath + " " + compilePath + " > /dev/null 2>&1", afterCompile);
								});
						});
				});
		};

		if (typeof inputTex === 'undefined')
				this.on('compile', compile);
		else
				compile(inputTex);

		return this;
};
/**
 * Parses the tex file of the document.
 *
 * @param {Stream} stream The stream to parse.
 * @return {Function} function(done).
 * @api private
 */

function parse(stream) {
		return function(done) {
				done(null, stream.toString('utf8'));
		};
}


/*
 * Remove compile directory
 * @param {type} path
 * @returns {undefined}
 */
function deleteFolderRecursive(path) {

		var files = [];
		if (fs.existsSync(path)) {
				files = fs.readdirSync(path);
				files.forEach(function(file, index) {
						var curPath = path + "/" + file;
						if (fs.lstatSync(curPath).isDirectory()) { // recurse
								deleteFolderRecursive(curPath);
						} else { // delete file
								fs.unlinkSync(curPath);
						}
				});
				fs.rmdirSync(path);
		}
};
/**
 * Proxy the archive `pipe()` method.
 */

Template.prototype.pipe = function() {
		var out = arguments;
		this.on('pipe', function(streamOutput) {
				streamOutput.pipe.apply(streamOutput, out);
		});
		return this;
};