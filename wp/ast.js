const spec = [
  [/^;/, null],
  [/^\s+/, null],
  [/^\/\/.*/, null],
  [/^{/, '{'],
  [/^}/, '}'],
  [/^\(/, '('],
  [/^\)/, ')'],
  [/^\[/, '['],
  [/^\]/, ']'],
  [/^,/, ','],
  [/^:/, ':'],
  [/^\b(let|var|const)\b/, 'dec'],
  [/^\bfor\b/, 'for'],
  [/^\bof\b/, 'of'],
  [/^\bin\b/, 'in'],
  [/^\bif\b/, 'if'],
  [/^\belse\b/, 'else'],
  [/^\btrue\b/, 'true'],
  [/^\bfalse\b/, 'false'],
  [/^\bnew\b/, 'new'],
  [/^\bnull\b/, 'null'],
  [/^\bimport\b/, 'import'],
  [/^\bexport\b/, 'export'],
  [/^\bdefault\b/, 'default'],
  [/^\basync\b/, 'async'],
  [/^\bawait\b/, 'await'],
  [/^\bfunction\b/, 'function'],
  [/^\breturn\b/, 'return'],
  [/^\byield\b/, 'yield'],
  [/^\bbreak\b/, 'break'],
  [/^\bcontinue\b/, 'continue'],
  [/^\bswitch\b/, 'switch'],
  [/^\bcase\b/, 'case'],
  [/^\bdo\b/, 'do'],
  [/^\bwhile\b/, 'while'],
  [/^\btry\b/, 'try'],
  [/^\bthrow\b/, 'throw'],
  [/^\bclass\b/, 'class'],
  [/^\bextends\b/, 'extends'],
  [/^\bsuper\b/, 'super'],
  [/^\bstatic\b/, 'static'],
  [/^\bthis\b/, 'this'],
  [/^\b(delete|typeof)\b/, 'unary'],
  [/^\binstanceof\b/, 'binary'],
  [/^0x[0-9A-Fa-f]+/, 'number'],
  [/^\d+/, 'number'],
  [/^\w+/, 'id'],
  [/^'[^']*?'/, 'string'],
  [/^"[^"]*?"/, 'string'],
  [/^(\/\^[^]*?\/.)/, 'regex'],
  [/^`((\${).*?}|.*?)*?`/s, 'template'],
  [/^${[^}]*?}/, 'var'],
  [/^[+\-]/, 'add'],
  [/^[*\/]/, 'mult'],
  [/^=>/, 'arrow'],
  [/^\?/, 'condition'],
  [/^&&/, 'and'],
  [/^\|\|/, 'or'],
  [/^!/, 'not'],
  [/^\.\.\./, 'rest'],
  [/^\.\./, 'binary'],
  [/^(<<|>>>|>>)/, 'binary'],
  [/^(&|%|\||\^)/, 'binary'],
  [/^[=!]==?/, 'binary'],
  [/^[><]=?/, 'binary'],
  [/^[\+\-\*\/\%\/]=/, 'complex'],
  [/^=/, 'assign'],
  [/^\./, '.'],
]

export default class Ast {
  constructor(content) {
    this.type = 'Program'
    this.content = content
    this.cursor = 0
    this.next = this.getNext()
    this.body = this.StatementList()
  }

  match(regexp, content) {
    const matched = regexp.exec(content)
    if (matched === null) return null
    this.cursor += matched[0].length
    return matched[0]
  }

  getNext() {
    if (!(this.cursor < this.content.length)) return null
    const content = this.content.slice(this.cursor)
    for (const [regexp, tokenType] of spec) {
      const tokenValue = this.match(regexp, content)
      if (tokenValue === null) continue
      if (tokenType === null) return this.getNext()
      return {type:tokenType, value:tokenValue}
    }
    throw new SyntaxError('unexpected token:', content[0])
  }

  lean(type) {
    const next = this.next
    if (next === null) throw new SyntaxError('end:', next)
    if (next.type !== type) throw new SyntaxError('expected:', type, 'got:', next)
    this.next = this.getNext()
    return next
  }

  StatementList(stop=null) {
    const statements = []
    do {
      statements.push(this.Statement())
    } while (this.next !== null && this.next.type !== stop)
    return statements
  }

  Statement() {
    switch (this.next.type) {
      case '{': return this.BlockStatement()
      case 'break': return this.BreakStatement()
      case 'class': return this.ClassDeclaration()
      case 'continue': return this.ContinueStatement()
      case 'dec': return this.VariableStatement()
      case 'do': return this.DoWhileStatement()
      case 'export': return this.ExportStatement()
      case 'for': return this.ForStatement()
      case 'async': return this.AsyncDeclaration()
      case 'function': return this.FunctionDeclaration()
      case 'if': return this.IfStatement()
      case 'import': return this.ImportStatement()
      case 'return': return this.ReturnStatement()
      case 'switch': return this.SwitchStatement()
      case 'throw': return this.ThrowStatement()
      case 'try': return this.TryStatement()
      case 'while': return this.WhileStatement()
      default: return this.ExpressionStatement()
    }
  }

  BlockStatement() {
    this.lean('{')
    const body = this.next.type !== '}' ? this.StatementList('}') : []
    this.lean('}')
    return {type:'BlockStatement', body}
  }

  ExpressionStatement() {
    const expression = this.Expression()
    return {type:'ExpressionStatement', expression}
  }

  LabeledStatement() {
    const labels = []
    while (this.next.type !== '}') {
      const label = this.PrimaryExpression()
      this.lean(':')
      const body = this.Expression()
      labels.push({type:'LabeledStatement', label, body})
      if (this.next.type === ',') this.lean(',')
    }
    return labels
  }

  IfStatement() {
    this.lean('if')
    this.lean('(')
    const test = this.Expression()
    this.lean(')')
    const consequent = this.Statement()
    const alternate = this.next.type === 'else' ? this.lean('else') && this.Statement() : null
    return {type:'IfStatement', test, consequent, alternate}
  }

  SwitchStatement() {
    this.lean('switch')
    this.lean('(')
    const discriminant = this.Expression()
    this.lean(')')
    this.lean('{')
    const occurences = []
    while (this.next.type === 'case') {
      this.lean('case')
      const test = this.Expression()
      this.lean(':')
      const consequent = []
      while (this.next.type !== 'case' && this.next.type !== 'default') consequent.push(this.Statement())
      occurences.push({test, consequent})
    }
    if (this.next.type === 'default') {
      this.lean('default')
      this.lean(':')
      const consequent = []
      while (this.next.type !== '}') consequent.push(this.Statement())
      occurences.push({consequent})
    }
    this.lean('}')
    return {type:'SwitchStatement', discriminant, occurences}
  }

  WhileStatement() {
    this.lean('while')
    this.lean('(')
    const test = this.Expression()
    this.lean(')')
    const body = this.Statement()
    return {type:'WhileStatement', test, body}
  }

  DoWhileStatement() {
    this.lean('do')
    this.lean('(')
    const body = this.Statement()
    this.lean(')')
    this.lean('while')
    const test = this.Expression()
    this.lean(')')
    return {type:'DoWhileStatement', body, test}
  }

  ForStatement() {
    this.lean('for')
    this.lean('(')
    const init = this.VariableStatement()
    let test
    if (this.next.type === 'in' || this.next.type === 'of') {
      test = this.next.type === 'in' ? this.lean('in').value : this.lean('of').value
      let right
      if (this.next.type === '[') {
        const elements = this.ArrayExpression()
        right = {type:'ArrayExpression', elements}
      } else {
        right = this.Expression()
      }
      this.lean(')')
      const body = this.Statement()
      return {type:'ForOfStatement', left:init, test, right, body} 
    }
    if (this.next.type !== ')') test = this.Statement() 
    if (this.next.type === ')') {
      this.lean(')')
      const body = this.Statement()
      return {type:'ForStatement', init, test, update:null, body}
    }
    const update = this.Expression()
    this.lean(')')
    const body = this.Statement()
    return {type:'ForStatement', init, test, update, body}
  }

  BreakStatement() {
    this.lean('break')
    let label = null
    if (this.next.type === 'id') label = this.Identifier()
    return {type:'BreakStatement', label}
  }

  ContinueStatement() {
    this.lean('continue')
    let label = null
    if (this.next.type === 'id') label = this.Identifier()
    return {type:'ContinueStatement', label}
  }

  ReturnStatement() {
    this.lean('return')
    const argument = this.Expression()
    return {type:'ReturnStatement', argument}
  }

  ThrowStatement() {
    this.lean('throw')
    const argument = this.Expression()
    return {type:'ThrowStatement', argument}
  }

  TryStatement() {
    this.lean('try')
    const block = this.BlockStatement()
    let handler = null
    let finalizer = null
    if (this.next.value === 'catch') {
      this.lean('id')
      handler = {}
      if (this.next.type === '(') {
        this.lean('(')
        handler.param = this.Expression()
        this.lean(')')
      } else {
        handler.param = null
      }
      handler.body = this.BlockStatement()
    }
    if (this.next.value === 'finally') {
      this.lean('id')
      finalizer = this.BlockStatement()
    }
    return {type:'TryStatement', block, handler, finalizer}
  }

  FunctionDeclaration(async=false) {
    this.lean('function')
    const id = this.next.type !== '(' ? this.Identifier() : null
    this.lean('(')
    const params = this.next.type !== ')' ? this.Parameters() : []
    this.lean(')')
    const body = this.BlockStatement()
    return {type:'FunctionDeclaration', async, id, params, body}
  }

  AsyncDeclaration() {
    this.lean('async')
    return this.FunctionDeclaration(true)
  }

  VariableInitializer() {
    this.lean('assign')
    return this.Expression()
  }

  VariableDeclaration() {
    const id = this.next.type === '[' ? this.ArrayExpression() : this.Identifier()
    const init = this.next.type === 'assign' ? this.VariableInitializer() : null
    return {type:'VariableDeclarator', id, init}
  }

  VariableDeclarationList() {
    const declarations = []
    do {
      declarations.push(this.VariableDeclaration())
    } while (this.next && this.next.type === ',' && this.lean(','))
    return declarations
  }

  VariableStatement() {
    let kind = this.lean('dec').value
    const declarations = this.VariableDeclarationList()
    let of = false
    if (this.next && (this.next.type === 'of' || this.next.type === 'in')) of = true
    return {type:'VariableDeclaration', declarations, kind, of}
  }

  ConditionalExpression(test) {
    this.lean('condition')
    const consequent = this.Expression()
    this.lean(':')
    const alternate = this.Expression()
    return {type:'ConditionalExpression', test, consequent, alternate}
  }

  UnaryExpression() {
    let operator
    switch (this.next.type) {
      case 'add':
        operator = this.lean('add').value
        return {type:'UnaryExpression', operator, argument:this.UnaryExpression()}
      case 'not':
        operator = this.lean('not').value
        return {type:'UnaryExpression', operator, argument:this.UnaryExpression()}
      case 'assign':
        operator = this.lean('assign').value
        return {type:'UpdateExpression', operator, argument:this.UnaryExpression(), prefix:true}
      case 'unary':
        operator = this.lean('unary').value + ' '
        return {type:'UnaryExpression', operator, argument:this.UnaryExpression()}
      default: return this.CallMemberExpression()
    }
  }

  SequenceExpression() {
    const expressions = []
    if (this.next.type !== '}') {
      do {
        expressions.push(this.Expression())
      } while (this.next.type === ',' && this.lean(','))
    }
    return {type:'SequenceExpression', expressions}
  }
  
  NewExpression() {
    this.lean('new')
    const callee = this.PrimaryExpression()
    this.lean('(')
    let expression = []
    if (this.next.type !== ')') expression = this.SequenceExpression()
    this.lean(')')
    return {type:'NewExpression', callee, arguments:expression}
  }

  Expression() {
    const left = this.LogicalNext(null)
    if (this.next) {
      if (this.next.type === 'assign') {
        const operator = this.lean('assign').value
        return {type:'AssignmentExpression', operator, left, right:this.Expression()}
      } else if (this.next.type === 'complex') {
        const operator = this.lean('complex').value
        return {type:'AssignmentExpression', operator, left, right:this.Expression()}
      }
    }
    return left
  }

  LogicalNext(type) {
    switch (this.next.type) {
      case 'function': return this.FunctionDeclaration()
      case 'new': return this.NewExpression() 
      default:
        switch(type) {
          case null: return this.LogicalExpression('or')
          case 'or': return this.LogicalExpression('and')
          case 'and': return this.LogicalExpression('arrow')
          case 'arrow': return this.LogicalExpression('not')
          case 'not': return this.LogicalExpression('binary')
          case 'binary': return this.LogicalExpression('in')
          case 'in': return this.LogicalExpression('condition')
          case 'condition': return this.LogicalExpression('add')
          case 'add': return this.LogicalExpression('mult')
          case 'mult': return this.LogicalExpression('.')
          default: return this.UnaryExpression()
        }
    }
  }
    
  LogicalExpression(token) {
    let left = {}
    if (this.next.type !== token) left = this.LogicalNext(token)
    while (this.next && this.next.type === token) {
      if (token === 'condition') {
        return this.ConditionalExpression(left)
      } else if (token === 'arrow') {
        return this.ArrowExpression([left])
      } else if (token === '.') {
        this.lean('.')
        const property = this.PrimaryExpression()
        left = {type:'MemberExpression', computed:false, object:left, property}
      } else {
        let right = {}
        let operator = this.lean(token).value
        if (operator === 'in') operator = ' in '
        else if (operator === 'instanceof') operator = ' instanceof '
        if (this.next.type === token) {
          this.lean(token)
          operator = operator + operator
          if (token === 'add') {
            const prefix = Object.keys(left).length === 0
            if (prefix) left = this.LogicalNext(token)
            return {type:'UpdateExpression', prefix, operator, argument:left}
          } else {
            right = this.LogicalNext(token)
          }
        } else if (token === 'arrow' && this.next.type === '{') {
          right = this.Statement()
        } else {
          right = this.LogicalNext(token)
        }
        left = {type:'LogicalExpression', operator, left, right}
      }
    }
    return left
  }

  CallMemberExpression() {
    const member = this.MemberExpression()
    if (this.next && (this.next.type === '(' || this.next.type === '[')) return this.CallExpression(member)
    return member
  }

  CallExpression(callee) {
    let callExpression = {type:'CallExpression', callee, arguments:this.Arguments()}
    if (this.next) {
      if (this.next.type === '(') {
        callExpression = this.CallExpression(callExpression)
      } else if (this.next.type === '[') {
        callExpression.computed = true
        this.lean('[')
        callExpression.property = this.PrimaryExpression()
        this.lean(']')
      }
    }
    return callExpression
  }

  Arguments() {
    if (this.next.type === '(') {
      this.lean('(')
      const sources = []
      while (this.next.type !== ')') {
        do {
          sources.push(this.Expression())
        } while (this.next.type === ',' && this.lean(','))
      }
      this.lean(')')
      return sources
    }
  }

  Parameters() {
    const params = []
    do {
      params.push(this.Expression())
    } while (this.next.type === ',' && this.lean(','))
    return params
  }

  MethodsList() {
    this.lean('{')
    const methods = []
    while (this.next.type !== '}') {
      const method = {type:'MethodDefinition'}
      if (this.next.type === 'static') {
        method.static = true
        this.lean('static')
      }
      if (this.next.type === 'async') {
        method.async = true
        this.lean('async')
      }
      method.key = this.next.type !== '(' ? this.Identifier() : null
      this.lean('(')
      method.params = this.next.type !== ')' ? this.Parameters() : []
      this.lean(')')
      method.body = this.BlockStatement()
      methods.push(method)
    }
    this.lean('}')
    return methods
  }
  
  ClassExtends() {
    this.lean('extends')
    return this.Identifier()
  }

  ClassDeclaration() {
    this.lean('class')
    const id = this.Identifier()
    const superClass = this.next.type === 'extends' ? this.ClassExtends() : null
    const body = this.MethodsList()
    return {type:'ClassDeclaration', id, superClass, body}
  }

  ExportStatement() {
    this.lean('export')
    if (this.next.type === 'default') {
      this.lean('default')
      const declaration = this.Statement()
      return {type:'ExportDefaultDeclaration', declaration}
    } else if (this.next.value === '*') {
      this.lean('mult')
      let exported
      if (this.next.value === 'as') {
        this.lean('id')
        exported = this.Identifier()
      }
      this.lean('id')
      const source = this.lean('string').value
      return {type:'ExportAllDeclaration', exported, source}
    } else if (this.next.type === '{') {
      this.lean('{')
      const specifiers = []
      if (this.next.type !== '}') {
        do {
          specifiers.push(this.Expression())
        } while (this.next.type === ',' && this.lean(','))
      }
      this.lean('}')
      this.lean('id')
      const source = this.lean('string').value
      return {type:'ExportNamedDeclaration', specifiers, source}
    } else {
      const declaration = this.Statement()
      return {type:'ExportNamedDeclaration', declaration}
    }
  }

  ImportStatement() {
    this.lean('import')
    if (this.next.type === '{') {
      this.lean('{')
      const specifiers = []
      if (this.next.type !== '}') {
        do {
          specifiers.push(this.Expression())
        } while (this.next.type === ',' && this.lean(','))
      }
      this.lean('}')
      this.lean('id')
      const source = this.next.value.slice(1, -1)
      this.lean('string')
      return {type:'ImportDeclaration', source, specifiers}
    }
    const specifiers = [this.Expression()]
    this.lean('id')
    const source = this.next.value.slice(1, -1)
    this.lean('string')
    return {type:'ImportDeclaration', source, specifiers}
  }

  PrimaryExpression() {
    switch (this.next.type) {
      case '[': return this.ArrayExpression()
      case '.': return this.MemberExpression()
      case '{': return this.ObjectExpression()
      case '(': return this.ParenthesizedExpression()
      case 'arrow': return this.ArrowExpression()
      case 'async': return this.AsyncExpression()
      case 'await': return this.AwaitExpression()
      case 'super': return this.SuperExpression()
      case 'this': return this.ThisExpression()
      case 'yield': return this.YieldExpression()
      case 'rest': return this.RestElement()
      case 'id': return this.Identifier()
      case 'template': return this.TemplateLiteral()
      case 'false': return this.BooleanLiteral(false)
      case 'true': return this.BooleanLiteral(true)
      case 'number': return this.NumericLiteral()
      case 'null': return this.NullLiteral()
      case 'regex': return this.RegExpLiteral()
      case 'string': return this.StringLiteral()
      default: return this.CallMemberExpression()
    }
  }

  ArrayExpression() {
    this.lean('[')
    const elements = []
    if (this.next.type !== ']') {
      do {
        elements.push(this.Expression())
      } while (this.next.type === ',' && this.lean(','))
    }
    this.lean(']')
    return {type:'ArrayExpression', elements}
  }

  MemberExpression() {
    let object = this.next.type !== '.' ? this.PrimaryExpression() : null
    while (this.next && (this.next.type === '.' || this.next.type === '[')) {
      if (this.next.type === '.') {
        this.lean('.')
        const property = this.Expression()
        object = {type:'MemberExpression', computed:false, object, property}
      } else {
        this.lean('[')
        const property = this.Expression()
        this.lean(']')
        object = {type:'MemberExpression', computed:true, object, property}
      }
    }
    return object
  }

  ObjectExpression() {
    this.lean('{')
    const properties = this.next.type !== '}' ? this.LabeledStatement() : []
    this.lean('}')
    return {type:'ObjectExpression', properties}
  }

  ParenthesizedExpression() {
    this.lean('(')
    const params = this.next.type !== ')' ? this.SequenceExpression() : {}
    this.lean(')')
    if (this.next && this.next.type === 'arrow') return this.ArrowExpression(params.expressions)
    return {type:'ParenthesizedExpression', expression:params}
  }

  ArrowExpression(params=[]) {
    this.lean('arrow')
    const body = this.Statement()
    return {type:'ArrowExpression', params, body}
  }

  AsyncExpression() {
    this.lean('async')
    return {type:'AsyncExpression', body:this.Statement()}
  }

  AwaitExpression() {
    this.lean('await')
    return {type:'AwaitExpression', argument:this.Statement()}
  }

  SuperExpression() {
    this.lean('super')
    return {type:'SuperExpression'}
  }

  ThisExpression() {
    this.lean('this')
    return {type:'ThisExpression'}
  }

  YieldExpression() {
    this.lean('yield')
    const delegate = this.next.value === 'mult'
    if (delegate) this.lean('mult')
    return {type:'YieldExpression', delegate, argument:this.Expression()}
  }

  RestElement() {
    this.lean('rest')
    return {type:'RestElement', argument:this.Expression()}
  }

  Identifier() {
    const name = this.lean('id').value
    return {type:'Identifier', name}
  }

  TemplateExpression() {
    while (this.next.type === '{') this.lean('{')
    const body = this.Expression()
    while (this.next.type === '}') this.lean('}')
    return body
  }

  TemplateLiteral() {
    let value = this.next.value
    if (value.indexOf('${') > -1) {
      let index = value.indexOf('${')
      const quasis = [{type:'TemplateElement', value:value.slice(1, index)}]
      const expressions = []
      this.cursor -= (value.length - index - 1)
      const startCursor = this.cursor
      this.next = this.getNext()
      value = value.slice(index + 2)
      const startLength = value.length + 1
      while (this.next.type === '{') {
        expressions.push(this.TemplateExpression())
        let opens = 1
        while (value.indexOf('{') > -1 && value.indexOf('{') < value.indexOf('}')) {
          value = value.slice(value.indexOf('{') + 1)
          opens += 1
        }
        while (opens > 0) {
          value = value.slice(value.indexOf('}') + 1)
          opens -= 1
        }
        let end = value.indexOf('${')
        if (end === -1) end = value.indexOf('`')
        quasis.push({type:'TemplateElement', value:value.slice(0, end)})
        value = value.slice(end + 1)
        this.cursor = startCursor + (startLength - value.length)
        this.next = this.getNext()
      }
      return {type:'TemplateLiteral', expressions, quasis}
    }
    value = this.lean('template').value
    const quasis = [{type:'TemplateElement', value:value.slice(1, -1)}]
    return {type:'TemplateLiteral', expressions:[], quasis}
  }

  BooleanLiteral(value) {
    this.lean(value ? 'true' : 'false')
    return {type:'BooleanLiteral', value}
  }

  NumericLiteral() {
    const value = Number(this.lean('number').value)
    return {type:'NumericLiteral', value}
  }

  NullLiteral() {
    this.lean('null')
    return {type:'NullLiteral'}
  }

  RegExpLiteral() {
    const pattern = this.lean('regex').value
    return {type:'RegExpLiteral', pattern}
  }

  StringLiteral() {
    const value = this.lean('string').value.slice(1, -1)
    return {type:'StringLiteral', value}
  }
}