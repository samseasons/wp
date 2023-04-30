import fs from 'fs'
import path from 'path'
import Ast from './ast.js'

const chars = 'abcdefghijklmnopqrstuvwxyz'
const charsLen = chars.length
const reservedNames = ['abstract', 'arguments', 'await', 'boolean', 'break', 'byte', 'case', 'catch',
  'char', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'double', 'else',
  'eval', 'export', 'extends', 'false', 'final', 'finally', 'float', 'for', 'function', 'goto', 'if',
  'implements', 'import', 'in', 'instanceof', 'int', 'interface', 'let', 'length', 'long', 'name',
  'native', 'new', 'null', 'package', 'private', 'protected', 'prototype', 'public', 'return', 'short',
  'static', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'true', 'try',
  'typeof', 'undefined', 'var','void', 'volatile', 'while', 'with', 'yield']

class State {
  constructor(rename=false) {
    this.rename = rename
    this.output = ''
  }

  Program(node) {
    const statements = node.body
    const { length } = statements
    for (let i = 0; i < length; i++) {
      const statement = statements[i]
      this[statement.type](statement)
    }
  }

  Sequence(nodes) {
    this.write('(')
    const { length } = nodes
    if (nodes && length > 0) {
      this[nodes[0].type](nodes[0])
      for (let i = 1; i < length; i++) {
        this.write(',')
        const param = nodes[i]
        this[param.type](param)
      }
    }
    this.write(')')
  }

  BlockStatement(node) {
    this.write('{')
    const statements = node.body
    if (statements !== null && statements.length > 0) {
      const { length } = statements
      for (let i = 0; i < length; i++) {
        const statement = statements[i]
        this[statement.type](statement)
      }
      this.delete(';')
    }
    this.delete(';')
    this.write('}')
  }

  ExpressionStatement(node) {
    this[node.expression.type](node.expression)
    this.write(';')
  }

  LabeledStatement(node) {
    this[node.label.type](node.label)
    this.write(':')
    this[node.body.type](node.body)
  }

  IfStatement(node) {
    this.write('if(')
    this[node.test.type](node.test)
    this.write(')')
    this[node.consequent.type](node.consequent)
    if (node.alternate) {
      this.write('else')
      if (node.alternate.type === 'IfStatement') this.write(' ')
      this[node.alternate.type](node.alternate)
    }
  }

  SwitchStatement(node) {
    this.write('switch(')
    this[node.discriminant.type](node.discriminant)
    this.write('){')
    const { occurences } = node
    const { length } = occurences
    for (let i = 0; i < length; i++) {
      const occurence = occurences[i]
      if (occurence.test) {
        this.write('case ')
        this[occurence.test.type](occurence.test)
        this.write(':')
      } else {
        this.write(' default:')
      }
      const { consequent } = occurence
      for (let i = 0; i < consequent.length; i++) {
        const statement = consequent[i]
        this[statement.type](statement)
      }
    }
    this.write('}')
  }

  WhileStatement(node) {
    this.write('while(')
    this[node.test.type](node.test)
    this.write(')')
    this[node.body.type](node.body)
  }

  DoWhileStatement(node) {
    this.write('do(')
    this[node.body.type](node.body)
    this.write(')while(')
    this[node.test.type](node.test)
    this.write(');')
  }

  ForStatement(node) {
    this.write('for(')
    if (node.init !== null) this[node.init.type](node.init)
    if (node.test) this[node.test.type](node.test)
    node.update ? this[node.update.type](node.update) : this.write(';')
    this.write(')')
    this[node.body.type](node.body)
  }

  ForOfStatement(node) {
    this.write('for(')
    const left = node.left
    this[left.type](left)
    this.write(' ' + node.test + ' ')
    this[node.right.type](node.right)
    this.write(')')
    this[node.body.type](node.body)
  }

  BreakStatement(node) {
    this.write('break')
    if (node.label !== null) {
      this.write(' ')
      this[node.label.type](node.label)
    }
    this.write(';')
  }

  ContinueStatement(node) {
    this.write('continue')
    if (node.label !== null) {
      this.write(' ')
      this[node.label.type](node.label)
    }
    this.write(';')
  }

  ReturnStatement(node) {
    this.write('return')
    if (node.argument) {
      this.write(' ')
      this[node.argument.type](node.argument)
    }
    this.write(';')
  }

  ThrowStatement(node) {
    this.write('throw ')
    this[node.argument.type](node.argument)
    this.write(';')
  }

  TryStatement(node) {
    this.write('try')
    this[node.block.type](node.block)
    if (node.handler) {
      const { handler } = node
      if (handler.param === null) {
        this.write('catch')
      } else {
        this.write('catch(')
        this[handler.param.type](handler.param)
        this.write(')')
      }
      this[handler.body.type](handler.body)
    }
    if (node.finalizer) {
      this.write('finally')
      this[node.finalizer.type](node.finalizer)
    }
  }

  FunctionDeclaration(node) {
    this.write(node.async ? 'async ' : '')
    this.write(node.generator ? 'function*' : 'function')
    if (node.num && this.rename && res[node.num] !== undefined) {
      this.write(' ')
      this.rewrite(node.num)
    } else {
      this.write(node.id ? ' ' + node.id.name : '')
    }
    this.Sequence(node.params)
    this[node.body.type](node.body)
  }

  VariableDeclaration(node) {
    this.write(node.kind + ' ')
    const { declarations } = node
    const { length } = declarations
    if (length > 0) {
      this.VariableDeclarator(declarations[0])
      for (let i = 1; i < length; i++) {
        this.write(',')
        this.VariableDeclarator(declarations[i])
      }
    }
    if (!node.of) this.write(';')
  }

  VariableDeclarator(node) {
    this[node.id.type](node.id)
    if (node.init !== null) {
      this.write('=')
      if (Array.isArray(node.init)) {
        this.write('[')
        const { length } = node.init
        if (length) {
          let init = node.init[0]
          this[init.type](init)
          for (let i = 1; i < length; i++) {
            this.write(',')
            init = node.init[i]
            this[init.type](init)
          }
        }
        this.write(']')
      } else {
        this[node.init.type](node.init)
      }
    }
  }

  SequenceExpression(node) {
    this.Sequence(node.expressions)
  }

  ConditionalExpression(node) {
    this[node.test.type](node.test)
    this.write('?')
    this[node.consequent.type](node.consequent)
    this.write(':')
    this[node.alternate.type](node.alternate)
  }

  UnaryExpression(node) {
    this.write(node.operator)
    this[node.argument.type](node.argument)
  }

  AssignmentExpression(node) {
    this[node.left.type](node.left)
    this.write(node.operator)
    this[node.right.type](node.right)
  }

  LogicalExpression(node) {
    const isIn = node.operator === 'in'
    if (isIn) this.write('(')
    if (node.left.type) this[node.left.type](node.left)
    this.write(node.operator)
    if (node.right.type) this[node.right.type](node.right)
    if (isIn) this.write(')')
  }

  UpdateExpression(node) {
    if (node.prefix) {
      this.write(node.operator)
      this[node.argument.type](node.argument)
    } else {
      this[node.argument.type](node.argument)
      this.write(node.operator)
    }
  }

  NewExpression(node) {
    this.write('new ')
    this[node.callee.type](node.callee)
    if (node.arguments.type) {
      this.write('(')
      this[node.arguments.type](node.arguments)
      this.write(')')
    } else {
      this.Sequence(node.arguments)
    }
  }

  CallExpression(node) {
    if (node.callee) this[node.callee.type](node.callee)
    this.Sequence(node.arguments)
    if (node.computed) {
      this.write('[')
      this[node.property.type](node.property)
      this.write(']')
    }
  }

  MemberExpression(node) {
    if (node.object) this[node.object.type](node.object)
    if (node.computed) {
      this.write('[')
      this[node.property.type](node.property)
      this.write(']')
    } else {
      this.write('.')
      this[node.property.type](node.property)
    }
  }

  YieldExpression(node) {
    this.write(node.delegate ? 'yield*' : 'yield')
    if (node.argument) {
      this.write(' ')
      this[node.argument.type](node.argument)
    }
  }

  ArrayExpression(node) {
    this.write('[')
    const { elements } = node
    const { length } = elements
    if (length > 0) {
      let element = elements[0]
      if (element !== null) this[element.type](element)
      for (let i = 1; i < length; i++) {
        this.write(',')
        element = elements[i]
        if (element !== null) this[element.type](element)
      }
    }
    this.write(']')
  }

  ObjectExpression(node) {
    this.write('{')
    const { properties } = node
    const { length } = properties
    if (length > 0) {
      let property = properties[0]
      this[property.type](property)
      for (let i = 1; i < length; i++) {
        this.write(',')
        property = properties[i]
        this[property.type](property)
      }
    }
    this.write('}')
  }

  ParenthesizedExpression(node) {
    this.write('(')
    if (node.expression.type) this[node.expression.type](node.expression)
    this.write(')')
  }

  ThisExpression(node) {
    this.write('this')
  }

  ClassDeclaration(node) {
    this.write('class ')
    this.rename && res[node.num] !== undefined ? this.rewrite(node.num) : this.write(node.id.name)
    if (node.superClass) {
      this.write('extends ')
      this[node.superClass.type](node.superClass)
    }
    this.BlockStatement(node)
  }

  ImportDeclaration(node) {}

  ExportAllDeclaration(node) {}

  ExportDefaultDeclaration(node) {
    this[node.declaration.type](node.declaration)
  }

  ExportNamedDeclaration(node) {
    if (node.declaration) this[node.declaration.type](node.declaration)
  }

  MethodDefinition(node) {
    if (node.static) this.write('static ')
    if (node.async) this.write('async ')
    this[node.key.type](node.key)
    this.Sequence(node.params)
    this[node.body.type](node.body)
  }

  ArrowExpression(node) {
    this.write(node.async ? 'async ' : '')
    const { params } = node
    if (params) this.Sequence(node.params)
    this.write('=>')
    if (node.body.type === 'ObjectExpression') {
      this.write('(')
      this.ObjectExpression(node.body)
      this.write(')')
    } else {
      this[node.body.type](node.body)
    }
    this.delete(';')
  }

  AsyncExpression(node) {
    this.write('async ')
    this[node.body.type](node.body)
  }

  AwaitExpression(node) {
    this.write('await ')
    this[node.argument.type](node.argument)
  }

  SuperExpression(node) {
    this.write('super ')
  }

  Identifier(node) {
    this.rename && node.num && res[node.num] !== undefined ? this.rewrite(node.num) : this.write(node.name)
  }

  RestElement(node) {
    this.write('...')
    this[node.argument.type](node.argument)
  }

  TemplateElement(node) {
    this.write(node.value)
  }

  TemplateLiteral(node) {
    const { quasis, expressions } = node
    this.write('`')
    for (let i = 0; i < quasis.length - 1; i++) {
      const quasi = quasis[i]
      const expression = expressions[i]
      this.write(quasi.value)
      this.write('${')
      this[expression.type](expression)
      this.write('}')
    }
    const quasi = quasis[quasis.length - 1]
    this.write(quasi.value, quasi)
    this.write('`')
  }

  BooleanLiteral(node) {
    this.write(node.value)
  }

  NumericLiteral(node) {
    this.write(node.value)
  }

  NullLiteral(node) {
    this.write('null')
  }

  RegExpLiteral(node) {
    this.write(node.pattern)
  }

  StringLiteral(node) {
    this.write('"' + node.value.replaceAll('"', "'") + '"')
  }

  write(code) {
    this.output += code
  }

  rewrite(code) {
    this.output += strings[res[code].toString()]
  }

  delete(code) {
    if (this.output.slice(-code.length) === code) this.output = this.output.slice(0, -code.length)
  }
}

class Scope {
	constructor(parent) {
		this.parent = parent
		this.declarations = new Map()
		this.references = new Map()
	}

	declare(node) {
    if (node.type === 'VariableDeclaration') {
      node.declarations.forEach(declarator => {
        extract(declarator.id).forEach(declaration => {
          this.declarations.set(declaration.name, node)
        })
      })
    } else if (node.type === 'MemberExpression' && node.object && node.object.type === 'ThisExpression' && !node.computed) {
			this.declarations.set(node.property.name, node)
    } else if (node.type === 'MethodDefinition') {
			this.declarations.set(node.key.name, node)
		} else if (node.id) {
			this.declarations.set(node.id.name, node)
		}
    return node
	}

	owner(name) {
		if (this.declarations.has(name)) return this
    const parentOwner = this.parent && this.parent.owner ? this.parent.owner(name) : null
		return this.parent && parentOwner
	}

	has(name) {
		return this.declarations.has(name) || (!!this.parent && this.parent.has(name))
	}
}

function extract(param, nodes=[]) {
	switch (param.type) {
		case 'Identifier':
			nodes.push(param)
			break
		case 'MemberExpression':
			let object = param
			while (object.type === 'MemberExpression') object = object.object
			nodes.push(object)
			break
		case 'ObjectExpression':
			param.properties.forEach(prop => {
        prop.type === 'RestElement' ? extract(prop.argument, nodes) : extract(prop.value, nodes)
      })
			break
		case 'ArrayExpression':
			param.elements.forEach(element => {
        if (element) extract(element, nodes)
      })
			break
		case 'RestElement':
			extract(param.argument, nodes)
			break
		case 'AssignmentExpression':
			extract(param.left, nodes)
			break
	}
	return nodes
}

function referred(node, parent) {
  if (node.type === 'MemberExpression') {
    return !node.computed && referred(node.object, node)
  } else if (node.type === 'Identifier') {
    if (!parent) return true
    switch (parent.type) {
      case 'MemberExpression': return parent.computed || node === parent.object
      case 'MethodDefinition': return parent.computed
      case 'Property': return parent.computed || node === parent.value
      case 'LabeledStatement':
      case 'BreakStatement':
      case 'ContinueStatement': return false
      default: return true
    }
  }
  return false
}

class Module {
  constructor(filePath) {
    this.filePath = filePath
    this.ast = new Ast(fs.readFileSync(filePath, 'utf-8'))
    this.map = new WeakMap()
    this.references = []
    this.imports = {}
    this.depth = 0
  }

  importDependencies() {
    this.dependencies = this.ast.body
      .filter(node => node.type === 'ImportDeclaration')
      .map(node => resolve(this.filePath, node.source))
      .map(absolutePath => createModule(absolutePath))
  }

  traverse(node, scope) {
    this.state[node.type](node, scope)
  }

  reference(scope, name) {
    if (scope.references) scope.references[name] = scope.scopeNums ? scope.scopeNums[name] : 0
    if (scope.parent) this.reference(scope.parent, name)
  }

  enter(node, parent) {
    switch (node.type) {
      case 'ExportAllDeclaration':
      case 'ExportDefaultDeclaration':
      case 'ExportNamedDeclaration':
        node.depth = -1
        if (Array.isArray(node.declaration)) {
          node.declaration.declarations.forEach((dec) => {
            scopes.declarations.set(dec.id, dec)
          })
        }
        break
      case 'ImportDeclaration':
        if (Array.isArray(node.specifiers)) {
          this.map.set(node, scopes = new Scope(scopes))
          node.specifiers.forEach((specifier) => {
            scopes.declarations.set(specifier.name, specifier)
            this.imports[specifier.name] = resolve(this.filePath, node.source)
          })
        }
        break
      case 'TryStatement':
        this.map.set(node, scopes = new Scope(scopes))
        if (node.param) extract(node.param).forEach(param => {
          scopes.declarations.set(param.name, node.param)
        })
        break
      case 'BlockStatement':
      case 'ForOfStatement':
      case 'ForStatement':
        this.map.set(node, scopes = new Scope(scopes))
        break
      case 'ClassDeclaration':
      case 'VariableDeclaration':
      case 'MemberExpression':
      case 'MethodDefinition': return scopes.declare(node)
      case 'ArrowExpression':
      case 'FunctionDeclaration':
        if (node.type === 'FunctionDeclaration' && node.id) scopes.declarations.set(node.id.name, node)
        node.params.forEach(params => {
          params.depth = parent.depth + 1
          extract(params).forEach(param => {
            param.depth = params.depth + 1
            scopes.declarations.set(param.name, node)
            param.scopeNums = parent.scopeNums ? parent.scopeNums : {}
            param.scopeNums[param.name] = nameNum
            freqs[nameNum] = 1
            param.num = nameNum
            nameNum += 1
            this.depths(param)
          })
          this.depths(params)
        })
        this.map.set(node, scopes = new Scope(scopes))
        break
      case 'Identifier':
        if (parent && referred(node, parent)) this.references.push([scopes, node])
        const name = node.name
        if (!(parent.property && parent.property.name === name && !parent.computed)) {
          node.num = parent.scopeNums[name]
          freqs[node.num] += 1
        }
        this.map.set(node, scopes = new Scope(scopes))
        break
    }
    return node
  }

  depths(node) {
    if (node.depth) {
      const nodeDepth = parseInt(node.depth)
      if (!(nodeDepth in depths)) depths[nodeDepth] = []
      if (!(node in depths[nodeDepth])) depths[nodeDepth].push(node)
    }
  }

  number(node, declarations) {
    let thisNum
    declarations.forEach((value, declaration) => {
      if (declaration === node.name || (node.id && declaration === node.id.name)) {
        if (declaration in node.scopeNums) {
          thisNum = node.scopeNums[declaration]
          freqs[thisNum] += 1
        } else {
          thisNum = nameNum
          node.scopeNums[declaration] = thisNum
          freqs[thisNum] = 1
          nameNum += 1
        }
        scopes.num = thisNum
        node.num = thisNum
        if (declaration in this.imports) {
          const basePath = this.imports[declaration]
          if (!(basePath in exports)) exports[basePath] = new Map()
          if (!(declaration in exports[basePath])) exports[basePath][declaration] = thisNum
        }
      }
    })
    this.depths(node)
    return node
  }

  walk1(node, parent) {
    if (node) {
      node.depth = parent.depth + 1
      node = this.enter(node, parent)
      node.scope = scopes
      node.scopeNums = parent ? parent.scopeNums : (node.scopeNums ? node.scopeNums : new Map())
      if (scopes.parent && scopes.parent.declarations) node = this.number(node, scopes.parent.declarations)
      if (scopes.declarations) node = this.number(node, scopes.declarations)
      this.walk(1, node)
    }
    if (this.map.has(node) && scopes !== null && scopes.parent) scopes = node.scope.parent
    for (let i = this.references.length - 1; i >= 0; --i) {
      const [scope, reference] = this.references[i]
      if (scope.references && !scope.references.has(reference.name)) this.reference(scope, reference.name)
    }
  }

  walk2(node, parent) {
    if (node.num) {
      node.childs = this.childs(parent, [])
      parent = node
    }
    this.walk(2, node, parent)
  }

  childs(node, childs) {
    if (node.num) childs.push(node.num)
    this.walk(3, node, childs)
    return childs
  }

  walk(w, node, pa=null) {
    for (let key in node) {
      const value = node[key]
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          const { length } = value
          for (let i = 0; i < length; i++) {
            const item = value[i]
            if (item && item.type) w === 1 ? this.walk1(item, node) : (w === 2 ? this.walk2(item, pa) : pa = this.childs(item, pa))
          }
        } else if (value.type) {
          w === 1 ? this.walk1(value, node) : (w === 2 ? this.walk2(value, pa) : pa = this.childs(value, pa))
        }
      }
    }
  }

  output() {
    this.state = new State(true)
    this.traverse(this.ast, scopes)
    return this.state.output
  }
}

const depths = {}
const exports = {}
const freqs = {}
const moduleMap = new Map()
let nameNum = 1
let scopes = new Scope(null)

function createModule(filePath) {
  if (!fs.existsSync(filePath)) throw new Error('not exists')
  if (!moduleMap.has(filePath)) {
    const module = new Module(filePath)
    module.importDependencies()
    moduleMap.set(filePath, module)
  }
  return moduleMap.get(filePath)
}

function nextNumber(renums, childs) {
  let skipNums = []
  for (let child of childs) {
    child = parseInt(child)
    if (child in renums) skipNums.push(renums[child])
  }
  let nextNum = skipNums.length
  for (let i = 0; i < nextNum; i++) {
    if (!skipNums.includes(i)) return i
  }
  return nextNum
}

let res = {'m': 0}
function resNumbers() {
  let depthKeys = Object.keys(depths)
  depthKeys.reverse()
  let nextNum
  const nodechilds = {}
  for (const d of depthKeys) {
    const depthNodes = depths[d]
    depthNodes.sort((a,b) => (freqs[a.num] > freqs[b.num]) ? 1 : ((freqs[b.num] > freqs[a.num]) ? -1 : 0))
    for (const node of depthNodes) {
      const nodeNum = parseInt(node.num)
      if (nodeNum) {
        let changeNumbers = false
        if (nodeNum in res) {
          for (const child of node.childs) {
            if (!(child in nodechilds[nodeNum])) {
              changeNumbers = true
              break
            }
          }
        } else {
          changeNumbers = true
        }
        if (changeNumbers) {
          nextNum = nextNumber(res, node.childs)
          res[nodeNum] = nextNum
          nodechilds[nodeNum] = {...node.childs, ...((nodeNum in nodechilds) ? nodechilds[nodeNum] : {})}
          if (nextNum > res['m']) res['m'] = nextNum
        }
      }
    }
  }
}

function newString(i) {
  let name = ''
  if (i >= charsLen) {
    for (let j = 0; j <= (Math.log(i) / Math.log(charsLen) - 1); j++) {
      name += chars.charAt(j % charsLen)
    }
  }
  name += chars.charAt(i % charsLen)
  return name
}

let strings = {}
function stringNumbers(max) {
  let i = 0
  for (let n = 0; n <= max; n++) {
    strings[n] = newString(i)
    while (reservedNames.includes(strings[n])) {
      i += 1
      strings[n] = newString(i)
    }
    i += 1
  }
}

function content(modules) {
  let walkModule
  let oldScopes
  let fileNum = 0
  for (const module of modules) {
    oldScopes = module.filePath in exports ? exports[module.filePath] : new Map()
    module.walk1(module.ast, {scopeNums:oldScopes, depth: 1})
    fileNum === 0 ? walkModule = module : walkModule.ast.body = [...module.ast.body, ...walkModule.ast.body]
    fileNum += 1
  }
  walkModule.walk2(walkModule, walkModule)
  resNumbers()
  stringNumbers(res['m'])
  return walkModule.output()
}

function resolve(requester, requestPath) {
  let filePath = path.join(path.dirname(requester), requestPath)
  if (filePath.slice(-3) !== '.js') filePath = filePath + '.js'
  return filePath
}

function collect(module, modules) {
  if (!modules.has(module)) {
    modules.add(module)
    module.dependencies.forEach(dependency => collect(dependency, modules))
  }
}

function collectModules(module) {
  const modules = new Set()
  collect(module, modules)
  return Array.from(modules)
}

function build(entryFile, outFile) {
  const module = createModule(entryFile)
  const modules = collectModules(module)
  const output = content(modules)
  fs.writeFileSync(outFile, output, 'utf-8')
}

const args = process.argv

build(args[2], args[3])