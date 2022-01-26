import { NODE, ROOT_NODE } from 'css-simple-parser/dist/types';
import * as Parser from 'css-simple-parser';
import { Position, TextDocument, CompletionItem, CompletionItemKind, TextEdit, Range } from "vscode";
import * as fse from "fs-extra";
import * as _ from "lodash";

export function getCurrentLine(
  document: TextDocument,
  position: Position
): string {
  return document.getText(document.lineAt(position).range);
}

/**
 * @TODO Refact by new Tokenizer
 */
export async function getAllClassNames(filePath: string, keyword: string): Promise<string[]> {
  // check file exists, if not just return []
  const filePathStat = await fse.stat(filePath);
  if (!filePathStat.isFile()) {
    return [];
  }

  const content = await fse.readFile(filePath, { encoding: "utf8" });
  let matchLineRegexp = /.*[,{]/g;

   // experimental stylus support
  if (filePath.endsWith(".styl") ||filePath.endsWith(".stylus")) {
    matchLineRegexp = /\..*/g
  }

 // nested scss '&' selectors

 const ast = Parser.parse ( content.replace(/\r?\n|\r|\s/g, "") );
 let rootNode: ROOT_NODE;
 Parser.traverse ( ast, node => {
   if(!rootNode) {
       rootNode = node as ROOT_NODE;
   }
 });


 const rootNodeReplaced = setSelectorName(rootNode.children, (rootNode as NODE).selector);
 const lines = getNestedSelectorNames(rootNodeReplaced);
 lines.push((rootNode as NODE).selector);

 if (lines === null) {
     return [];
 }

//   const lines = content.match(matchLineRegexp);
//   if (lines === null) {
//     return [];
//   }

  const classNames = lines.join(" ").match(/\.[_A-Za-z0-9-]+/g);
  if (classNames === null) {
    return [];
  }

  const uniqNames = _.uniq(classNames).map((item) => item.slice(1)).filter((item) => !/^[0-9]/.test(item));
  return keyword !== ""
    ? uniqNames.filter((item) => item.indexOf(keyword) !== -1)
    : uniqNames;
}

function setSelectorName(childNodes: NODE[], parentSelectorName: string) {
    if(childNodes.length === 0) {
        return "";
    }

    return childNodes.map(item => {
        const currentSelectorName = item.selector.replace('&', parentSelectorName)
        return {...item, selector: currentSelectorName, children: setSelectorName(item.children, currentSelectorName), parent: {...item.parent, selector: parentSelectorName}};
    });
}

function getNestedSelectorNames(childNodes: NODE[], selectors: string[]=[]) {
    if(childNodes.length === 0) {
        return [];
    }

    childNodes.map(item => {
        selectors.push(item.selector);
        getNestedSelectorNames(item.children, selectors);
    });

    return selectors;
}

// from css-loader's implementation
// source: https://github.com/webpack-contrib/css-loader/blob/22f6621a175e858bb604f5ea19f9860982305f16/lib/compile-exports.js
export function dashesCamelCase(str: string): string {
  return str.replace(/-(\w)/g, function (match, firstLetter) {
    return firstLetter.toUpperCase();
  });
}

/**
 * check kebab-case classname
 */
export function isKebabCaseClassName (className: string): boolean {
  return className?.includes('-');
}

/**
 * BracketCompletionItem Factory
 */
export function createBracketCompletionItem (className: string, position: Position): CompletionItem {
  const completionItem = new CompletionItem(className, CompletionItemKind.Variable);
  completionItem.detail = `['${className}']`;
  completionItem.documentation = "kebab-casing may cause unexpected behavior when trying to access style.class-name as a dot notation. You can still work around kebab-case with bracket notation (eg. style['class-name']) but style.className is cleaner.";
  completionItem.insertText = `['${className}']`;
  completionItem.additionalTextEdits = [new TextEdit(new Range(new Position(position.line, position.character - 1),
      new Position(position.line, position.character)), '')];
  return completionItem;
}
