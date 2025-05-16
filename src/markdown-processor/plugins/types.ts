/**
 * Type definitions for working with AST nodes
 */

// Rehype (HAST) Node types
export interface MyElement {
  type: 'element'
  tagName: string
  properties?: {
    [key: string]: string | string[] | number | boolean | undefined
  }
  children: (MyElement | MyText)[]
}

export interface MyText {
  type: 'text'
  value: string
}

export interface MyRoot {
  type: 'root'
  children: (MyElement | MyText)[]
}
