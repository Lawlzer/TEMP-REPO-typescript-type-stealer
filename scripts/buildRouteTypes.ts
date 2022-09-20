import { ensureExists, getAllFiles, getFlag } from '@lawlzer/helpers';
import * as fs from 'fs';
import path from 'path';
import * as ts from 'typescript';

const pathToRoutes = path.resolve(getFlag('inputPath') as string);
const outputPathRoutes = path.resolve(getFlag('outputPath') as string);

interface CustomInterface {
	currentPath: string; // in a .d.ts file, should not actually be used/shown
	sourcePath: string; // The (hopeful) path to the real file
	originalName: string;
	newName: string; // Ideally this will be originalName, but it will be changed if there's a conflict.

	exported: boolean; // Is this interface exported from the file?
	text: string; // The actual text of the interface
}

function isInterfaceDeclaration(node: ts.Node): node is ts.InterfaceDeclaration {
	return node.kind === ts.SyntaxKind.InterfaceDeclaration;
}

function isTypeDeclaration(node: ts.Node): node is ts.TypeAliasDeclaration {
	return node.kind === ts.SyntaxKind.TypeAliasDeclaration;
}

function saveInterface(node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration, foundInterfaces: CustomInterface[]) {
	const interfaceAlreadyExists = foundInterfaces.find((existingInterface) => existingInterface.text === node.getText());
	if (interfaceAlreadyExists) return;

	const currentPath = node.getSourceFile().fileName;
	if (currentPath.includes('node_modules')) return;

	// TODO this sourcePath needs a less hacky solution :(
	const sourcePath = currentPath.replace(`${pathToRoutes}`, '/src/').replace('.d.ts', '.ts');

	const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
	const isExported = modifiers?.find((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ? true : false;

	const customInterface: CustomInterface = {
		currentPath: currentPath,
		sourcePath: sourcePath,
		originalName: node.name.getText(),
		newName: node.name.getText(),
		text: node.getText(),
		exported: isExported,
	};
	foundInterfaces.push(customInterface);
}

function recursiveSaveInterfaces(checker: ts.TypeChecker, interfaceDeclaration: ts.InterfaceDeclaration | ts.TypeAliasDeclaration, foundInterfaces: CustomInterface[]) {
	saveInterface(interfaceDeclaration, foundInterfaces);
	const interfaceName = interfaceDeclaration.name.getText();
	console.log('interfaceName: ', interfaceName);
	if (interfaceName === 'two') { 
		console.log('\ninterface two debug: ', interfaceDeclaration); 
		// from here, how do we get the [key: string]: Hello2; part? It's not an interfaceMember...
		// process.exit(); 
	}
	
	if (interfaceName === 'three') { 
		// Here, we need the extends Hello3 part.
		console.log('\ninterface three debug: ', interfaceDeclaration);
		// process.exit(); 
	}

	const interfaceSymbol = checker.getSymbolAtLocation(interfaceDeclaration.name);
	if (!interfaceSymbol) throw new Error(`no symbol for interface: ${interfaceName}`);

	const interfaceType = checker.getDeclaredTypeOfSymbol(interfaceSymbol);
	const interfaceMembers = checker.getPropertiesOfType(interfaceType);

	console.log('0');
	interfaceMembers.map((member) => {
		if (!member.valueDeclaration) throw new Error(`no valueDeclaration for member: ${member.name}`);

		const myRealInterface = checker.getTypeOfSymbolAtLocation(member, member.valueDeclaration);

		const symbol = myRealInterface.getSymbol();
		if (!symbol) console.log('No symbol for member.name: ', member.name);
		if (!symbol) return;
		if (!symbol) throw new Error('no symbol for myRealInterface');

		//
		const declarations = symbol.getDeclarations();
		if (!declarations) throw new Error('no declarations found');
		declarations.map((declaration) => {
			if (isInterfaceDeclaration(declaration) || isTypeDeclaration(declaration)) {
				recursiveSaveInterfaces(checker, declaration, foundInterfaces);
			}


			// check if it's a heritageClause
			if (ts.isHeritageClause(declaration)) {
				console.log('WE FOUND A HERITAGE CLAUSE');
				(process as any).exit();
				const type = checker.getTypeAtLocation(declaration);
				const symbol = type.getSymbol();
				if (!symbol) return;

				const declarations = symbol.getDeclarations();
				if (!declarations) throw new Error('no declarations found');

				declarations.map((declaration) => {
					if (isInterfaceDeclaration(declaration) || isTypeDeclaration(declaration)) {
						recursiveSaveInterfaces(checker, declaration, foundInterfaces);
					}
				});
			}
		});
	});
}

/** Return only the used types from a given file */
function handleOneFile(inputPath: string, outputPath: string): void {
	console.log('Working on file: ', inputPath);
	// Build a program using the set of root file names in fileNames
	const program = ts.createProgram([inputPath], { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });
	const checker = program.getTypeChecker(); // THIS IS THE KEY! This updates stuff to have type checking, I guess.

	const isMapFile = inputPath.endsWith('.map');
	if (isMapFile) return;

	// Visit every sourceFile in the program
	const sourceFile = program.getSourceFile(inputPath);
	if (!sourceFile) throw new Error(`Could not find source file: ${inputPath}`);

	const isPlainTypescriptFile = sourceFile.fileName.endsWith('.ts') && !sourceFile.isDeclarationFile;
	if (isPlainTypescriptFile) console.info("WARNING: This is a plain TypeScript file, not a Declaration file. If there are any absolute imports, there will be issues in the output. It's recommended that you pre-parse with TSC-alias, to avoid import issues.");

	const symbol = checker.getSymbolAtLocation(sourceFile);
	if (!symbol) throw new Error(`no symbol for sourceFile: ${sourceFile.fileName}`);

	const foundInterfaces: CustomInterface[] = [];
	sourceFile.statements.map((statement) => {
		const isGoodStatement = statement.kind === ts.SyntaxKind.InterfaceDeclaration || statement.kind === ts.SyntaxKind.TypeAliasDeclaration;
		if (!isGoodStatement) return;
		if (!isGoodStatement) throw new Error(`Statement is not an interface or type alias: ${statement.getText()}`);

		if (isInterfaceDeclaration(statement) || isTypeDeclaration(statement)) {
			recursiveSaveInterfaces(checker, statement, foundInterfaces);
		}
	});

	let output = '// This "types" file was automatically generated by the NPM script "buildRoutes" by Lawlzer. Do not edit it manually.\n\n';

	let index = 0; // Used to easily have a different name for each interface
	for (const interfaceSingle of foundInterfaces) {
		output += `\n// Path to source: ${interfaceSingle.sourcePath}`;
		output += `\n// DEBUG: currentPath: ${interfaceSingle.currentPath}`;
		output += `\n// DEBUG: originalName: ${interfaceSingle.originalName}`;
		output += `\n// DEBUG: newName: ${interfaceSingle.newName}`;
		if (!interfaceSingle.exported) output += `\n// DEBUG: This interface is not exported`;
		if (interfaceSingle.exported) output += `\nimport { ${interfaceSingle.originalName} as _${++index} } from '${interfaceSingle.sourcePath.replace('.ts', '')}';`;
		output += `\n${interfaceSingle.text}`;
		output += `\n\n\n`;
	}

	fs.writeFileSync(outputPath, output);
	console.info(`Successfully wrote to file: ${outputPath}`);
	process.exit(); // since we're just trying to debug the get.ts file, we can exit after the first file. TEMP 
}

(async () => {
	const allRoutes = await getAllFiles(pathToRoutes);

	for await (const inputPath of allRoutes) {
		const outputPath = inputPath.replace(pathToRoutes, outputPathRoutes).replace('.d.ts', '.ts');

		await ensureExists(path.dirname(outputPath));
		handleOneFile(inputPath, outputPath);
	}
	console.info('Successfully generated all files!');
	process.exit(0);
})();
