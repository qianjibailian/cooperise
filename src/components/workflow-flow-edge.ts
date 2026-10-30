import { PolylineEdge, PolylineEdgeModel } from '@logicflow/core'

/** 流程连线配色：正向灰蓝实线，回退橙色虚线，选中/悬停主题紫 */
export const WF_EDGE_COLOR = '#a8adbd'
export const WF_BACK_COLOR = '#fa8c16'
export const WF_ACTIVE_COLOR = '#722ed1'

/** 流程连线：properties.isBack=true 时渲染为回退样式；properties.hidden 时整条线隐藏（数据仍在） */
class WfEdgeModel extends PolylineEdgeModel {
  setAttributes() {
    // 折线拐点离节点的距离，默认 30 偏大，节点间距紧凑时会绕出很长的弯
    ;(this as any).offset = 20
  }
  /** 回退线较多时可临时隐藏（只影响显示，不改变连线数据） */
  private isHidden(): boolean {
    return !this.isSelected && !!this.properties?.hidden
  }
  private strokeColor(): string {
    if (this.isSelected || this.isHovered) return WF_ACTIVE_COLOR
    return this.properties?.isBack ? WF_BACK_COLOR : WF_EDGE_COLOR
  }
  getEdgeStyle() {
    const style = super.getEdgeStyle()
    if (this.isHidden()) return { ...style, stroke: 'transparent', strokeWidth: 0, opacity: 0, strokeDasharray: '' }
    style.stroke = this.strokeColor()
    style.strokeWidth = this.isSelected ? 2 : 1.5
    style.strokeDasharray = this.properties?.isBack ? '5 4' : ''
    return style
  }
  getArrowStyle() {
    const style = super.getArrowStyle()
    const color = this.strokeColor()
    style.stroke = color
    style.fill = color
    style.strokeDasharray = ''
    style.offset = 8
    style.verticalLength = 4
    if (this.isHidden()) return { ...style, stroke: 'transparent', fill: 'transparent', opacity: 0 }
    return style
  }
  getTextStyle() {
    const style = super.getTextStyle()
    style.fontSize = 12
    style.color = this.properties?.isBack ? WF_BACK_COLOR : '#595959'
    style.background = { fill: '#ffffff', stroke: 'transparent', radius: 4, wrapPadding: '2px,6px' } as any
    if (this.isHidden()) return { ...style, color: 'transparent', opacity: 0, background: { ...style.background, fill: 'transparent' } as any }
    return style
  }
}

export const WF_EDGE_TYPE = 'wfEdge'
export const wfEdgeRegister = { type: WF_EDGE_TYPE, view: PolylineEdge, model: WfEdgeModel }
