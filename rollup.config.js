import { terser } from "rollup-plugin-terser";

function bundle(format, {minify} = {}) {
	let filename = "dragula";

	if (format !== "esm") {
		filename += "." + format;
	}

	if (minify) {
		filename += ".min";
	}

	return {
		file: `dist/${filename}.js`,
		name: "dragula",
		format: format,
		sourcemap: format !== "esm",

		plugins: [
			minify? terser({
				compress: true,
				mangle: true
			}) : undefined
		]
	};
}

// Same as a rollup.config.js
export default {
	input: "dragula.js",
	output: [
		bundle("iife"),
		bundle("iife", {minify: true}),
		bundle("esm"),
		bundle("esm", {minify: true}),
		bundle("cjs"),
		bundle("cjs", {minify: true})
	],
};