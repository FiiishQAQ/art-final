'use client'

import * as d3 from "d3";
import {memo, useCallback, useEffect, useRef} from "react";
import {BaseNode, layerName, Nodes, NodeType, Path, Relation} from "@/app/page";
import {flatten, groupBy, update} from "lodash-es";
import {Color, RGBColor} from "d3";

const padding = 64;
const leftExtra = 16;
const groupPadding = 0.4;
const groupGap = 9;
const dotRadius = 2;


type GroupRect = {
  w: number,
  h: number,
  x: number,
  y: number,
  name: string,
  color?: Color,
  classes: string,
  paths: Path[],
};

function deduplicatedPush(node: BaseNode, arr: any[], hashArr: { [key: string | number]: BaseNode }) {
  if (!hashArr[node.identity]) {
    hashArr[node.identity] = node;
    arr.push(node);
  }
}

let mouseTimeout: NodeJS.Timeout | null = null;

const Graph = memo(function Graph({paths, onOverPath, layerOrder}: { paths: Path[], onOverPath: (p: Path[]) => void, layerOrder: number[]}) {
  const width = window.innerWidth * 0.6;
  const height = window.innerHeight;

  console.log('rerender', paths)
  const vGap = (height - 2 * padding) / (5);
  const svgRef = useRef<SVGSVGElement>(null);
  const svgDefsRef = useRef<SVGDefsElement>(null);

  const [nodes, relations] = paths.reduce(([nodes, relations], path) => {
    const pathClass = 'pc' + path.map(node => node?.identity ?? '').join('_');
    path.forEach(node => node && (node.pathClass = pathClass));

    let start: BaseNode | undefined;

    for (let i = 0; i < layerOrder.length; i++) {
      const thisStart = path[layerOrder[i]];

      if (thisStart !== undefined) {
        thisStart.indexInPath = i;
        if (i > 0 && start !== undefined) {
          const startI = start?.identity + '';
          const endI = thisStart?.identity + '';

          relations.push({
            identity: startI + endI,
            start: +startI,
            end: +endI,
            source: start,
            target: thisStart,
            pathClass: pathClass,
            path: thisStart.path,
          });
        }

        start = thisStart;
        nodes[i].push(start);
      }
    }

    return [nodes, relations];
  }, [[[], [], [], [], [], []], []] as [BaseNode[][], Relation[]]);

  const calcNodeCord = useCallback(function (
    subNodes: BaseNode[],
    layer: number,
    keyExtractor: (node: BaseNode) => string,
    overlap: boolean = false,
    colorScheme = d3.scaleOrdinal(d3.schemeCategory10),
  ) {
    const groupRects: GroupRect[] = [];
    const nodeGroups = Object.entries(groupBy(subNodes, keyExtractor));
    let nodeGap = overlap ? 0.3 : Math.min(
      (width - (padding * 2 + leftExtra) - (nodeGroups.length - 1) * groupGap - (nodeGroups.length * 2 * groupPadding * 1.5)) / (subNodes.length - 1),
      6
    );
    const textY = padding + vGap * (layer - 1) + groupPadding;

    const lineWidth = nodeGroups
      .reduce((acc, [groupName, nodes], index) => {
        return acc + (index === 0 ? 0 : 1) * groupGap + 2 * groupPadding + dotRadius * 2 + (nodes.length - 1) * nodeGap;
      }, 0);

    const lineOffset = (width - leftExtra - 2 * padding - lineWidth) / 2;
    nodeGroups
      .reduce((acc, [groupName, nodes], index) => {
        const groupStart = acc + (index === 0 ? 0 : 1) * groupGap;
        const groupEnd = groupStart + 2 * groupPadding + (nodes.length - 1) * nodeGap + dotRadius * 2;
        const groupColor = d3.color(colorScheme(index + '')) ?? undefined;

        let groupClass = '';

        nodes.forEach(
          (node, index) => {
            groupClass += node.pathClass + ' ';
            node.y = lineOffset + groupStart + groupPadding + index * nodeGap + dotRadius;
            node.x = textY;
            node.color = groupColor;
          }
        );
        groupRects.push({
          w: groupEnd - groupStart,
          h: groupPadding * 2 + dotRadius * 2,
          x: lineOffset + groupStart,
          y: textY - groupPadding - dotRadius,
          name: groupName,
          color: groupColor,
          classes: groupClass,
          paths: nodes.map(node => node.path)
        })
        return groupEnd;
      }, padding + leftExtra);

    return {nodeGap, groupRects};
  }, [paths]);

  // const did = useRef(false);

  useEffect(() => {
    console.log('rerender')

    // if (did.current) return;
    // did.current = true;

    const svg = d3.select(svgRef.current);
    const defs = d3.select(svgDefsRef.current);

    const mask = svg.select('.mask')
      .attr('fill', 'rgba(255,255,255,0)')
      .attr('width', width)
      .attr('height', height)

    const allGroupRects = nodes.map((nodes, index) => calcNodeCord(
      nodes,
      index + 1,
      (
        nodes[0]?.labels.includes(NodeType.TEXT) ?
          (node) => node.ichCate?.properties.ns1__name :
          (node) => node.properties.rdf__value
      ),
      !nodes[0]?.labels.includes(NodeType.TEXT),
      [
        d3.scaleOrdinal(d3.schemeSet1),
        d3.scaleOrdinal(d3.schemeAccent),
        d3.scaleOrdinal(d3.schemeCategory10),
        d3.scaleOrdinal(d3.schemeSet2),
        d3.scaleOrdinal(d3.schemeSet3),
        d3.scaleOrdinal(d3.schemeTableau10)
      ][layerOrder[index]]
    ).groupRects)

    const textNodeOrder = layerOrder.findIndex(i => i === 0);
    const allNormalGroupRects = allGroupRects.filter((_, i) => i !== textNodeOrder);
    const textNodeRects = allGroupRects[textNodeOrder];

    function switchHighlight(pathClass: string = '', toState: 'show' | 'hide' = 'hide', isGroup = false) {
      // mouseTimeout && clearTimeout(mouseTimeout);
      // mouseTimeout = setTimeout(() => {
      //   d3.selectAll('.highlighting')
      //     .classed('highlighting', false)

        if (toState === 'show') {
          mask
            .transition()
            .style('fill', 'rgba(255,255,255,0.7)')
            .each(function () {
              (this as any).parentNode.appendChild(this);
            })

          d3.selectAll(pathClass)
            .classed('highlighting' + (isGroup ? '_group' : ''), true)
            .each(function () {
              (this as any).parentNode.appendChild(this);
            });
        } else if (toState === 'hide') {
          console.log('hiding')
          d3.selectAll('.highlighting')
            .classed('highlighting', false)

          d3.selectAll('.highlighting_group')
            .classed('highlighting_group', false)

          mask
            .transition()
            .style('fill', 'rgba(255,255,255,0)')

          d3.selectAll('.textGroupRectText, .textNodeGroupRectText, .textGroupRect')
            .each(function () {
              (this as any).parentNode.appendChild(this);
            });
        }
      // }, 25)
    }

    const y = d3.scaleLinear([0, 5], [padding, height - padding]);

    svg.selectAll('.yAxis').remove();
    console.log('draw g')
    svg
      .append("g")
      .classed('yAxis', true)
      .call(d3.axisLeft(y)
        .tickValues(d3.ticks(0, 5, 6))
        .tickFormat((x) => layerName[layerOrder[x.valueOf()]]))
      .call(g => g.selectAll(".tick line").clone()
        .attr("stroke-opacity", 0.1)
        .attr("x2", width))
      .call(g => g.select(".domain").remove());

    defs.selectAll('.relation-gradient')
      .data(relations, d => (d as Relation).identity)
      .join(
        enter => {
          enter
            .append("linearGradient")
            .attr("id", d => `rlg-${d.identity}`)
            .attr("class", "relation-gradient")
            .attr("x1", d => d.source.y ?? 0)
            .attr("y1", d => d.source.x ?? 0)
            .attr("x2", d => d.source.y ?? 0)
            .attr("y2", d => d.target.x ?? 0)
            .attr("gradientUnits", "userSpaceOnUse")
            .selectAll("stop")
            .data(d => [
              {offset: "0%", color: d.source.color?.toString() ?? ''},
              {offset: "100%", color: d.target.color?.toString() ?? ''}
            ])
            .enter()
            .append("stop")
            .attr("offset", d => d.offset)
            .attr("stop-color", d => d.color);
        },
        update => {
          update
            .attr("x1", d => d.source.y ?? 0)
            .attr("y1", d => d.source.x ?? 0)
            .attr("x2", d => d.source.y ?? 0)
            .attr("y2", d => d.target.x ?? 0)
            .selectAll("stop")
            .data(d => [
              {offset: "0%", color: d.source.color?.toString() ?? ''},
              {offset: "100%", color: d.target.color?.toString() ?? ''}
            ])
            .join(
              enter => {
                enter
                  .append("stop")
                  .attr("offset", d => d.offset)
                  .attr("stop-color", d => d.color);
              },
              update => update.attr("stop-color", d => d.color),
              exit => exit.remove()
            )
        },
        exit => {
          exit.remove()
        }
      )

    svg.selectAll('.textNodeGroupRect')
      .data(flatten(textNodeRects), (rect) => (rect as GroupRect).name)
      .join(
        enter => {
          enter
            .append('rect')
            .attr('class', d => d.classes + ' textNodeGroupRect')
            .attr('width', d => d.w + 4)
            .attr('height', d => d.h + 4)
            .attr('x', d => d.x - 2)
            .attr('y', d => d.y - 2)
            .attr('rx', groupPadding + dotRadius + 1)
            // .attr('fill', d => (d.color as RGBColor)?.brighter(1).copy({opacity: 0.8}).toString() ?? '')
            .attr('fill', 'none')
            .attr('stroke', d => (d.color as RGBColor)?.copy({opacity: 0.3}).toString() ?? '')
            // .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .on('mouseover', (event, d) => {
              onOverPath(d.paths);
              const groupClass = d.classes.trim().split(' ').map(c => '.' + c).join(',');
              switchHighlight(groupClass, 'show', true)
            })
            .on('mouseout', () => switchHighlight())
        },
        update => {
          update
            .attr('class', d => d.classes + ' textNodeGroupRect')
            .attr('width', d => d.w + 4)
            .attr('height', d => d.h + 4)
            .attr('x', d => d.x - 2)
            .attr('y', d => d.y - 2)
            .attr('stroke', d => (d.color as RGBColor)?.copy({opacity: 0.3}).toString() ?? '')
        },
        exit => {
          exit.remove()
        }
      )

    svg.selectAll('.relation')
      .data(relations, d => (d as Relation).identity)
      .join(
        enter => {
          return enter.append("path")
            .attr("class", d => [d.pathClass, "relation"].join(' '))
            // @ts-ignore
            .attr("d", d3.linkVertical()
              // @ts-ignore
              .x(d => d.y)
              // @ts-ignore
              .y(d => d.x))
            .attr("stroke", d => `url(#rlg-${d.identity})`)
            .on('mouseover', (event, d) => {
              onOverPath([d.path]);
              d.pathClass && switchHighlight('.'+d.pathClass, 'show')
            })
            .on('mouseout', () => switchHighlight())
        },
        update => {
          update
            .attr("class", d => [d.pathClass, "relation"].join(' '))
            // @ts-ignore
            .attr("d", d3.linkVertical()
              // @ts-ignore
              .x(d => d.y)
              // @ts-ignore
              .y(d => d.x))
            .attr("stroke", d => `url(#rlg-${d.identity})`)
        },
        exit => {
          exit
            .transition()
            .attr('style', 'opacity: 0')
            .remove()
        }
      )

    svg.selectAll('.textNode')
      .data(flatten(nodes), (node) => (node as { identity: number }).identity)
      .join(
        enter => {
          enter.append('circle')
            .attr("class", d => [d.pathClass, "textNode"].join(' '))
            .attr('r', dotRadius)
            .attr('fill', d => d.color?.toString() ?? '')
            .attr('cy', d => d.x ?? -10)
            .attr('cx', d => d.y ?? -10)
            .on('mouseover', (event, d) => {
              onOverPath([d.path]);
              d.pathClass && switchHighlight('.'+d.pathClass, 'show')
            })
            .on('mouseout', () => switchHighlight())
        },
        update => {
          update
            .transition()
            .attr('fill', d => d.color?.toString() ?? '')
            .attr("class", d => [d.pathClass, "textNode"].join(' '))
            .attr('cy', d => d.x ?? -10)
            .attr('cx', d => d.y ?? -10)
        },
        exit => {
          exit.remove()
        }
      )

    svg.selectAll('.textGroupRect')
      .data(flatten(allNormalGroupRects), (rect) => (rect as GroupRect).name)
      .join(
        enter => {
          enter.append('rect')
            .attr('class', d => d.classes + ' textGroupRect')
            .attr('width', d => d.w)
            .attr('height', d => d.h)
            .attr('x', d => d.x)
            .attr('y', d => d.y)
            .attr('rx', groupPadding + dotRadius)
            // .attr('fill', d => (d.color as RGBColor)?.brighter(1).copy({opacity: 0.8}).toString() ?? '')
            .attr('fill', 'rgba(255,255,255,0.1)')
            // .attr('stroke', d => (d.color as RGBColor)?.copy({opacity: 0.3}).toString() ?? '')
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .on('mouseover', (event, d) => {
              onOverPath(d.paths);
              const groupClass = d.classes.trim().split(' ').map(c => '.' + c).join(',');
              switchHighlight(groupClass, 'show', true)
            })
            .on('mouseout', () => switchHighlight())
        },
        update => {
          update
            .attr('class', d => d.classes + ' textGroupRect')
            .attr('width', d => d.w)
            .attr('height', d => d.h)
            .attr('x', d => d.x)
            .attr('y', d => d.y)
            .attr('rx', groupPadding + dotRadius)
            .attr('fill', 'rgba(255,255,255,0.1)')
        },
        exit => {
          exit.remove()
        }
      )

    svg.selectAll('.textNodeGroupRectText')
      .data(flatten(textNodeRects), (rect) => (rect as GroupRect).name)
      .join(
        enter => {
          enter
            .append('text')
            .attr('class', d => d.classes + ' textNodeGroupRectText')
            .attr('x', d => d.x - 2)
            .attr('y', d => d.y - 6)
            .attr('fill', d => (d.color as RGBColor).darker(1).toString() ?? '')
            .text(d => d.name)
            .on('mouseover', (event, d) => {
              onOverPath(d.paths);
              const groupClass = d.classes.trim().split(' ').map(c => '.' + c).join(',');
              switchHighlight(groupClass, 'show', true)
            })
            .on('mouseout', () => switchHighlight())
        },
        update => {
          update
            .attr('class', d => d.classes + ' textNodeGroupRectText')
            .transition()
            .attr('x', d => d.x - 2)
            .attr('y', d => d.y - 6)
            .attr('fill', d => (d.color as RGBColor).darker(1).toString() ?? '')
            .text(d => d.name)
        },
        exit => {
          exit.remove()
        }
      )

    svg.selectAll('.textGroupRectText')
      .data(flatten(allNormalGroupRects), (rect) => (rect as GroupRect).name)
      .join(
        enter => {
          enter
            .append('text')
            .attr('class', d => d.classes + ' textGroupRectText')
            .attr('x', d => d.x + d.w / 2)
            .attr('y', d => d.y + d.h * 2 + 3)
            .attr('fill', d => (d.color as RGBColor).darker(1).toString() ?? '')
            .text(d => d.name)
            .on('mouseover', (event, d) => {
              onOverPath(d.paths);
              const groupClass = d.classes.trim().split(' ').map(c => '.' + c).join(',');
              switchHighlight(groupClass, 'show', true)
            })
            .on('mouseout', () => switchHighlight())
        },
        update => {
          update
            .attr('class', d => d.classes + ' textGroupRectText')
            .transition()
            .attr('x', d => d.x + d.w / 2)
            .attr('y', d => d.y + d.h * 2 + 3)
            .attr('fill', d => (d.color as RGBColor).darker(1).toString() ?? '')
            .text(d => d.name)
        },
        exit => {
          exit.remove()
        }
      )

    setTimeout(() => {
      d3.selectAll('.textGroupRectText, .textNodeGroupRectText, .textGroupRect')
        .each(function () {
          (this as any).parentNode.appendChild(this);
        });
    }, 100);
  }, [calcNodeCord, nodes, layerOrder, paths, relations]);

  return (
    <svg ref={svgRef} height={height} width={width}>
      <defs ref={svgDefsRef} />
      <rect className={'mask'} />
    </svg>
  );
}, (prev, next) => prev.paths === next.paths && prev.layerOrder.toString() === next.layerOrder.toString())

export default Graph;
