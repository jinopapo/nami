const exportedFunctionObjectMessage =
  'Do not export an object that groups functions. Export each function directly instead.';

const exportedPropertyTypeMessage =
  'Do not export a local type only to use it as a property type of another exported type. Keep the property type local or inline it.';

const isFunctionExpression = (node) =>
  node?.type === 'ArrowFunctionExpression' || node?.type === 'FunctionExpression';

const getDeclarationName = (node) => {
  if (node?.type === 'Identifier') {
    return node.name;
  }
  return undefined;
};

const getTypeName = (node) => {
  if (node?.type === 'TSTypeReference') {
    return getDeclarationName(node.typeName);
  }
  if (node?.type === 'TSExpressionWithTypeArguments') {
    return getDeclarationName(node.expression);
  }
  return undefined;
};

const isExportedDeclaration = (node) =>
  node?.parent?.type === 'ExportNamedDeclaration' ||
  node?.parent?.type === 'ExportDefaultDeclaration';

const createNoExportedFunctionObjectRule = () => ({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow exported objects that group functions.',
    },
    messages: {
      exportedFunctionObject: exportedFunctionObjectMessage,
    },
    schema: [],
  },
  create(context) {
    const localFunctionNames = new Set();

    const isFunctionReferenceProperty = (property) => {
      if (
        property.type !== 'Property' &&
        property.type !== 'PropertyDefinition'
      ) {
        return false;
      }
      if (property.method) {
        return true;
      }
      if (isFunctionExpression(property.value)) {
        return true;
      }
      if (
        property.value?.type === 'Identifier' &&
        localFunctionNames.has(property.value.name)
      ) {
        return true;
      }
      return false;
    };

    const reportIfFunctionObject = (node, init) => {
      if (init?.type !== 'ObjectExpression') {
        return;
      }
      if (!init.properties.some(isFunctionReferenceProperty)) {
        return;
      }
      context.report({
        node,
        messageId: 'exportedFunctionObject',
      });
    };

    return {
      FunctionDeclaration(node) {
        if (node.id?.name) {
          localFunctionNames.add(node.id.name);
        }
      },
      VariableDeclarator(node) {
        const name = getDeclarationName(node.id);
        if (name && isFunctionExpression(node.init)) {
          localFunctionNames.add(name);
        }
      },
      'Program:exit'(node) {
        for (const statement of node.body) {
          if (statement.type === 'ExportNamedDeclaration') {
            const declaration = statement.declaration;
            if (declaration?.type !== 'VariableDeclaration') {
              continue;
            }
            for (const declarator of declaration.declarations) {
              reportIfFunctionObject(declarator.id, declarator.init);
            }
          }
          if (statement.type === 'ExportDefaultDeclaration') {
            reportIfFunctionObject(statement.declaration, statement.declaration);
          }
        }
      },
    };
  },
});

const createNoExportedPropertyTypeAggregationRule = () => ({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow exporting local property types through exported object types.',
    },
    messages: {
      exportedPropertyType: exportedPropertyTypeMessage,
    },
    schema: [],
  },
  create(context) {
    const exportedTypeDeclarations = new Map();
    const exportedTypeNamesUsedAsProperties = new Set();

    const visitTypeNode = (node, visitor) => {
      if (!node || typeof node.type !== 'string') {
        return;
      }
      visitor(node);
      for (const [key, value] of Object.entries(node)) {
        if (
          key === 'parent' ||
          key === 'loc' ||
          key === 'range' ||
          key === 'tokens' ||
          key === 'comments'
        ) {
          continue;
        }
        if (!value) {
          continue;
        }
        if (Array.isArray(value)) {
          for (const item of value) {
            visitTypeNode(item, visitor);
          }
          continue;
        }
        if (typeof value === 'object' && typeof value.type === 'string') {
          visitTypeNode(value, visitor);
        }
      }
    };

    const collectPropertyTypeReferences = (node) => {
      if (!isExportedDeclaration(node)) {
        return;
      }
      visitTypeNode(node, (current) => {
        const isPropertyType =
          current.type === 'TSPropertySignature' ||
          current.type === 'PropertyDefinition';
        if (!isPropertyType) {
          return;
        }
        const typeAnnotation = current.typeAnnotation?.typeAnnotation;
        visitTypeNode(typeAnnotation, (typeNode) => {
          const name = getTypeName(typeNode);
          if (name) {
            exportedTypeNamesUsedAsProperties.add(name);
          }
        });
      });
    };

    const rememberExportedTypeDeclaration = (node) => {
      if (!isExportedDeclaration(node)) {
        return;
      }
      if (node.id?.name) {
        exportedTypeDeclarations.set(node.id.name, node);
      }
    };

    return {
      TSTypeAliasDeclaration(node) {
        rememberExportedTypeDeclaration(node);
        collectPropertyTypeReferences(node);
      },
      TSInterfaceDeclaration(node) {
        rememberExportedTypeDeclaration(node);
        collectPropertyTypeReferences(node);
      },
      TSEnumDeclaration(node) {
        rememberExportedTypeDeclaration(node);
      },
      'Program:exit'() {
        for (const name of exportedTypeNamesUsedAsProperties) {
          const declaration = exportedTypeDeclarations.get(name);
          if (!declaration) {
            continue;
          }
          context.report({
            node: declaration.id ?? declaration,
            messageId: 'exportedPropertyType',
          });
        }
      },
    };
  },
});

export const noGroupedExportsPlugin = {
  rules: {
    'no-exported-function-object': createNoExportedFunctionObjectRule(),
    'no-exported-property-type-aggregation':
      createNoExportedPropertyTypeAggregationRule(),
  },
};
