import * as React from "react"
import { IFieldzSingleState } from "@zecos/fieldz/types"
import { ReactFieldzSingleActions } from "@zecos/react-fieldz"
import { field } from "@zecos/fieldz"

const camelToTitle = camelCase => camelCase
  .replace(/([A-Z])/g, match => ` ${match}`)
  .replace(/([0-9]+)/g, match => ` ${match}`)
  .replace(/^./g, match => match.toUpperCase())
  .trim()

const titleToKebab = title => title
  .replace(/ ([A-Z])/g, match => `-${match.trim()}`)
  .toLowerCase()
  
const kebabToSnake = (kebab: string) => kebab.replace("-", "_")

const camelToUpperCamel = (name: string) => name.charAt(0).toUpperCase() + name.slice(1)

export interface IInputHelpers {
  title: string
  camel: string
  kebab: string
  "aria-label": string
  onChange: (e: React.ChangeEvent) => void
  onBlur: (e: any) => void
  label: string
  name: string
  snake: string
  id: string
  htmlFor: string
  upperCamel: string
}

export const getHelpers = ({actions, name}): IInputHelpers => {
  const title = camelToTitle(name)
  const kebab = titleToKebab(title)
  const snake = kebabToSnake(kebab)
  const upperCamel = camelToUpperCamel(name)
  const camel = name
  const id = kebab
  const _name = kebab
  const label = title
  const htmlFor = _name
  const { setValue, setTouched } = actions
  const onChange = e => setValue(e.target.value)
  const onBlur = () => setTouched()

  return {
    onChange,
    onBlur,
    id,
    name: _name,
    label,
    "aria-label": title,
    camel,
    upperCamel,
    title,
    kebab,
    snake,
    htmlFor,
  }
}
export interface IInputOpts {
  name: string
  init?: any
  validate?: (inputs?: any) => Error[]
  props?: { [key: string]: any}
  useState?: boolean
  updater?: () => void
}

interface IInputProps {
  state: IFieldzSingleState
  actions: ReactFieldzSingleActions
  helpers: IInputHelpers
  props: { [key: string]: any }
}

export interface IInput {
  Cmpt: React.FC
  state: IFieldzSingleState
  actions:ReactFieldzSingleActions
  meta: IMeta
  helpers: IInputHelpers
  name: string
  [key: string]: any
}

interface IMeta {
  $$__inputs_type: string
}

export type InputCreator = (opts: IInputOpts) => IInput
type InputCreatorCreator = (InputCmpt: React.FC<IInputProps>) => InputCreator

const reactify = (fn, update) => (...args) => {
  fn(...args)
  update()
} 

const inputGetter = ({InputCmpt, init, validate, update, name}) => {
    const actions = field({
      init: typeof init === "undefined" ? "" : init,
      validate,
    })
    const reactActions = {}
    const {getState, ...toReactify} = actions
    for (const actionName in toReactify) {
      reactActions[actionName] = reactify(actions[actionName], update)
    }
    
    const helpers = getHelpers({actions: reactActions, name})
    return {
      Cmpt: props => {
        const state = actions.getState()
        return (
          <InputCmpt
            props={{
              ...props,
            }}
            helpers={helpers}
            state={state}
            actions={reactActions}
          />
        )
    },
    helpers,
    actions: {
      getState,
      ...reactActions,
    },
    named: {
      [name + "Actions"]: actions,
      [name + "Helpers"]: helpers,
    }
  }
}

let update:any = () => {
  throw new Error("Something went wrong. This should never happen.")
}
let inMulti = false
const createUpdater = () => {
  const [state, setState] = React.useState(false)
  let x = state
  return () => {
    console.log("updating")
    x = !x
    setState(!x)
  }
}

export const createInput = (InputCmpt):any => (opts: IInputOpts) => {
  const {init, name} = opts
  const validate = opts.validate || (() => [])
  const initialProps = opts.props || {}
  const _update = (inMulti && update) || createUpdater()

  // have to use singleton to make sure it doesn't create another
  // input every render and lose focus
  /*<[WithPropsFC, IInputHelpers]>*/
  const [{
    Cmpt,
    helpers,
    actions,
    named,
  }] = (inMulti && [inputGetter({
    InputCmpt,
    init,
    validate,
    update: _update,
    name,
  })]) || React.useState(() => inputGetter({
    InputCmpt,
    init,
    validate,
    update: _update,
    name,
  }))
  const meta = {$$__inputs_type: "input"}
  const state = actions.getState()
  const CmptWithProps = Cmpt

  return {
    Cmpt: CmptWithProps,
    state,
    actions,
    meta,
    helpers,
    [helpers.upperCamel]: CmptWithProps,
    [name + "State"]: state,
    [name + "Meta"]: meta,
    ...named,
    name,
  }
}

export interface ILayoutHelpers {
  kebab: string
  snake: string
  title: string
  upperCamel: string
  name: string
}

export interface ILayoutOpts {
  name: string
  inputs?: any[]
  validate?: (inputs?: any[]) => Error[]
  props?: { [key: string]: any}
}

interface ILayoutProps {
  helpers: ILayoutHelpers
  inputs: any[]
  props: { [key: string]: any}
  errors: Error[]
}

const getType = val => {
  if (typeof val === "object" && typeof val.meta === "object") {
    return val.meta.$$__inputs_type
  }
  return "unknown"
}

const getUpdated = item => {
  if (getType(item) === "input") {
    return {
      ...item,
      state: item.actions.getState()
    }
  } else if (getType(item) === "layout") {
    return {
      ...item,
      inputs: item.inputs.map(getUpdated)
    }
  }
  return item
}

export interface ILayout {
  Cmpt: React.FC
  meta: IMeta
  helpers: ILayoutHelpers
  name: string
  errors: Error[]
  [key: string]: any
}

export type LayoutCreator = (opts: ILayoutOpts) => ILayout
type LayoutCreatorCreator = (LayoutCmpt: React.FC<ILayoutProps>) => LayoutCreator
type WithPropsFC = (props: any) => React.FC

export const createLayout:LayoutCreatorCreator = LayoutCmpt => opts => {
  const { name } = opts
  if (typeof name === "undefined") {
    throw new Error("You must provide a camelcased name for the layout.")
  }
  let inputs = opts.inputs || []
  const validate = opts.validate || (() => [])
  const initialProps = opts.props || {}

  const [[Cmpt, helpers]] = React.useState<[WithPropsFC, ILayoutHelpers]>(() => {
    const title = camelToTitle(name)
    const kebab = titleToKebab(title)
    const snake = kebabToSnake(kebab)
    const upperCamel = camelToUpperCamel(name)
    const helpers:ILayoutHelpers = {kebab, snake, title, name, upperCamel}
    const fc = (initialProps: any):React.FC =>  props => {
      inputs = inputs.map(getUpdated)
      const errors = validate(inputs)
      return (
        <LayoutCmpt
          inputs={inputs}
          props={{
            ...initialProps,
            ...props,
          }}
          errors={errors}
          helpers={helpers}
        />
      )
    }

    return [fc, helpers]
  })
  const errors = validate(inputs)
  const meta = {$$__inputs_type: "layout"}
  const CmptWithProps = Cmpt(initialProps)

  return {
    Cmpt: CmptWithProps,
    inputs,
    errors,
    meta,
    helpers,
    name,
    [helpers.upperCamel]: CmptWithProps,
    [name + "Inputs"]: inputs,
    [name + "Errors"]: errors,
    [name + "Meta"]: meta,
    [name + "Helpers"]: helpers,
  }
}

type MultiCreateFn = () => (ILayout | IInput)[]

interface ICreateMultiOpts {
  name: string
  create: MultiCreateFn
  validate?: (inputs: any[]) => Error[]
  init?: (ILayout | IInput)[]
  props?: { [key: string]: any}
}
const setMulti = (_update) => {
  inMulti = true
  update = _update
}
const unsetMulti = () => {
  inMulti = false
  update = () => {
    throw new Error("Something is wrong. This should never happen.")
  }
}

type TGetCmpt = (() => (ILayout | IInput))
type WithPropsAndStateFC = (props: any, state: any) => React.FC
type MultiSetState = [WithPropsAndStateFC, ILayoutHelpers]

export const createMulti = (MultiCmpt:any) => (opts: ICreateMultiOpts) => {
  const { name } = opts
  if (typeof name === "undefined") {
    throw new Error("You must provide a camelcased name for the multi-input.")
  }
  const initialProps = opts.props || {}
  const init = opts.init || []
  const validate = opts.validate || (() => [])
  const [state, setState] = React.useState(init)
  const [[Cmpt, helpers]] = React.useState<MultiSetState>(() => {
    const title = camelToTitle(name)
    const kebab = titleToKebab(title)
    const snake = kebabToSnake(kebab)
    const upperCamel = camelToUpperCamel(name)
    const helpers = {kebab, snake, title, name, upperCamel}
    const fc = (initialProps: any, state):React.FC =>  props => {
      state = state.map(getUpdated)
      const errors = validate(state)
      return (
        <MultiCmpt
          inputs={state}
          props={{
            ...initialProps,
            ...props,
          }}
          errors={errors}
          helpers={helpers}
        />
      )
    }

    return [fc, helpers]
  })
  
  const _update = createUpdater()
  const splice = (start:number, deleteCount:number, ...getCmpts: TGetCmpt[]) => {
    const cmpts = getCmpts.map(fn => fn())
    const newState = [
      ...state.slice(0, start-1),
      ...cmpts,
      ...state.slice(start + deleteCount - 1)
    ]
    setState(newState)
    return state.slice(start, start + deleteCount - 1)
  }
  const push = (...args: TGetCmpt[]) => {
    setMulti(_update)
    const cmpts = args.map(fn => fn())
    const newState = [...state, ...cmpts]
    setState(state)
    unsetMulti()
    return newState.length
  }
  const pop = () => {
    setState(state.slice(0, state.length - 1))
    return state[state.length - 1]
  }
  const sort = (compareFn?) => {
    const sorted = state.slice().sort(compareFn)
    setState(sorted)
    return sorted
  }
  const reverse = () => {
    const reversed = state.slice().reverse()
    setState(reversed)
    return reversed
  }
  const shift = () => {
    const newState = state.slice()
    const shiftVal = newState.shift()
    setState(newState)
    return shiftVal
  }
  const unshift = (...args: TGetCmpt[]) => {
    setMulti(_update)
    const newCmpts = args.map(fn => fn())
    const newState = [...newCmpts, ...state]
    setState(newState)
    return newState.length
  }
  const fill = (fn: TGetCmpt, start, end) => {
    const newState = [
      ...state.slice(0, start),
      ...([...new Array(end - start)].map(() => fn())),
      ...state.slice(end + 1)
    ]
    setState(newState)
  }
  const actions = {
    fill,
    unshift,
    shift,
    reverse,
    sort,
    pop,
    push,
    splice,
  }
  const errors = validate(state)
  const meta = {$$__inputs_type: "multi"}
  const CmptWithProps = Cmpt(initialProps, state)
  return {
    Cmpt: CmptWithProps,
    inputs:state,
    errors,
    meta,
    helpers,
    name,
    actions,
    [helpers.upperCamel]: CmptWithProps,
    [name + "Inputs"]: state,
    [name + "Errors"]: errors,
    [name + "Meta"]: meta,
    [name + "Helprs"]: helpers,
  }
}