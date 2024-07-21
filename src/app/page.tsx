'use client'

import Graph from "@/app/((comp))/Graph";
import {Color} from "d3";
import {estDriver} from "@/lib/neo4j";
import {Fragment, useCallback, useEffect, useState} from "react";
import {Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage} from "@/components/ui/form";
import {useForm} from "react-hook-form";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Separator} from "@/components/ui/separator";
import {ChevronsUpDown, Inbox} from "lucide-react";
import {Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious} from "@/components/ui/carousel";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {SortableList} from "@/components/SortableList";
import {doQuery} from "@/app/action";

const layerName = ['文本', '文本属性', '三级子主题', '二级子主题', '一级子主题', '主题']

export {layerName}

const initialLayerOrder = [0, 1, 2, 3, 4, 5];

export type BaseNode = {
  identity: number;
  labels: {
    [key: string]: any
  };
  properties: {
    [key: string]: any
  };
  path: Path,
  pre?: BaseNode,
  suf?: BaseNode,
  x?: number,
  y?: number,
  color?: Color,
  pathClass?: string,
  ichCate?: BaseNode,
  indexInPath?: number,
}

export type Path = [
  textNode: BaseNode & { ichCate: NodeType } | undefined,
  typeNode: BaseNode | undefined,
  subSubjectNodes1: BaseNode | undefined,
  subSubjectNodes2: BaseNode | undefined,
  subSubjectNodes3: BaseNode | undefined,
  subjectNode: BaseNode | undefined,
];

export type Relation = {
  identity: string;
  start: number;
  end: number;
  source: BaseNode;
  target: BaseNode;
  path: Path;
  pathClass?: string;
};

export enum NodeType {
  ICH_BROCADE = "ns0__artisticFeatureBrocade",
  ICH_EMBROIDERY = "ns0__artisticFeatureEmbroidery",
  ICH_NYP = "ns0__artisticFeatureNewYearPicture",
  TEXT = "ns0__artisticFeatureDescription",
  TYPE = "ns0__artisticFeatureFeatureType",
  SUB_SUBJECT = "ns0__artisticFeatureSubSubject",
  SUBJECT = "ns0__artisticFeatureSubject",
}

export type Nodes = {
  layerNum: number,
  ichNodes: (BaseNode & {})[],
  textNodes: (BaseNode & {})[],
  typeNodes: (BaseNode & {})[],
  subSubjectNodes: [(BaseNode & {})[], (BaseNode & {})[], (BaseNode & {})[]],
  subjectNodes: (BaseNode & {})[],
}

function deduplicatedPush(node: BaseNode, arr: any[], hashArr: { [key: string | number]: BaseNode }) {
  if (!hashArr[node.identity]) {
    hashArr[node.identity] = node;
    arr.push(node);
  }
}

const ichTypes = [
  {
    cate: '锦',
    types: ['云锦', '宋锦', '蜀锦']
  },
  {
    cate: '绣',
    types: ['羌绣', '京绣',]
  },
  {
    cate: '年画',
    types: ['年画', '凤翔', '杨柳青', '桃花坞']
  },
]

export default function Home() {
  const [records, setRecords] = useState<any[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedIchTypes, setSelectedIchTypes] = useState<string[]>([]);


  useEffect(() => {
    doQuery(keyword, selectedIchTypes, ichTypes.flatMap(({types}) => types))
      .then((res) => {
        setRecords(res)
      });
    window.onresize = () => {
      setRecords(r => [...r])
    }
    return () => {
      window.onresize = null;
    }
  }, [])
  // const records1 = await doQuery();

  let nodes: Nodes = {
    layerNum: 6,
    ichNodes: [],
    textNodes: [],
    typeNodes: [],
    subSubjectNodes: [[], [], []],
    subjectNodes: [],
  };

  const [paths, setPaths] = useState<Path[]>([]);

  useEffect(() => {
    const tempPaths: Path[] = [];
    records.forEach((pathObj) => {
      let segments = pathObj.p.segments;

      const path: Path = [undefined, undefined, undefined, undefined, undefined, undefined];
      let subSubjectLayer = 0;

      const pathSubSubjects: BaseNode[] = [];
      (segments as any[]).forEach((segment) => {
        const start = segment.start;

        type segEndWithPath = typeof segment.end & { path: Path };
        const end: segEndWithPath = segment.end as segEndWithPath;
        end.path = path;

        if (
          start.labels.includes(NodeType.ICH_BROCADE) ||
          start.labels.includes(NodeType.ICH_EMBROIDERY) ||
          start.labels.includes(NodeType.ICH_NYP)
        ) {
          // @ts-ignore
          end.ichCate = start;
          // @ts-ignore
          path[0] = end;
        } else if (end.labels.includes(NodeType.TYPE)) {
          path[1] = end;
        } else if (end.labels.includes(NodeType.SUB_SUBJECT)) {
          pathSubSubjects.push(end);
        } else if (end.labels.includes(NodeType.SUBJECT)) {
          pathSubSubjects.forEach((item, index) => path[2 + index + (3 - pathSubSubjects.length)] = item);
          path[5] = end;
        }
      })
      tempPaths.push(path);
    })
    setPaths(tempPaths);
  }, [records]);

  // @ts-ignore
  // console.log(groupBy(nodes.subjectNodes, (node) => node.properties.rdf__value.trim()));

  const form = useForm()

  const [highlightingPaths, setHighlightingPaths] = useState<Path[]>([])

  function emphasizeKeyword(text: string, keyword: string) {
    if (!text || !keyword) return text;
    return text.replace(new RegExp(`(${keyword})`, 'g'), '<span class="bg-yellow-200">$1</span>')
  }

  const makeNodeCard = useCallback((layer: number, node: BaseNode | undefined, index?: number) => {
    switch (layer) {
      case 0:
        return (
          <div className={'border rounded-xl py-3 px-4 shadow'}>
            <p className={'text-sm text-gray-400'}>文本 {(index ?? 0) + 1}/{highlightingPaths.length}</p>
            <p
              className={'py-1 text-sm text-gray-600'}
              dangerouslySetInnerHTML={{__html: emphasizeKeyword(node?.properties.ns2__description, keyword)}}
            />
            <div className={'py-1'}>
              <p className={'text-xs text-gray-400'}>技术词汇</p>
              <div
                className={'flex flex-wrap gap-1 py-1 text-sm text-gray-600'}>
                {
                  node?.properties.ns0__artisticFeaturelexic && node?.properties.ns0__artisticFeaturelexic?.filter((item: string) => item).map((word: string) => (
                    <div
                      key={word}
                      className={'rounded-3xl px-2 py-1 border'}
                      dangerouslySetInnerHTML={{__html: emphasizeKeyword(word, keyword)}}
                    />
                  ))
                }</div>
            </div>
            <div className={'py-1'}>
              <p className={'text-xs text-gray-400'}>技术词汇密度</p>
              <p
                className={'py-1 text-sm text-gray-600'}>{node?.properties.ns0__artisticFeaturelexicalDensity ?? '--'}</p>
            </div>
          </div>
        );
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
        let val = node?.properties.rdf__value;
        return (
          <div className={'border rounded-xl py-3 px-4 shadow ' + (val ? '' : 'opacity-30')}>
            <p className={'text-sm text-gray-400'}>{layerName[layer]}</p>
            <p
              className={'py-1 text-sm text-gray-600'}
              dangerouslySetInnerHTML={{__html: emphasizeKeyword(val, keyword) ?? '--'}}
            />
          </div>
        )
      default:
        return null;
    }
  }, [highlightingPaths.length, keyword])

  const [layerOrder, setLayerOrder] = useState(
    initialLayerOrder.map(layer => ({id: layer + 1}))
  );

  return (
    <main id='main-container' className="flex h-screen items-center justify-stretch">
      <div className='card h-full flex-1 p-4 min-w-20'>
        <h2 className="my-2 font-bold text-2xl text-gray-700">探索</h2>
        <Form {...form}>
          <FormField
            control={form.control}
            name='form'
            render={({field}) => (
              <FormItem>
                <FormLabel>非遗类别</FormLabel>
                <FormControl>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className='w-full gap-2 justify-between px-3'>
                        <div className={'flex-1 text-ellipsis overflow-hidden text-left'}>
                          {
                            selectedIchTypes.length > 0 ? selectedIchTypes.join(', ') :
                              <span className='font-normal opacity-[0.63]'>筛选非遗类别</span>
                          }
                        </div>
                        <ChevronsUpDown size={14} className={'opacity-[0.63] flex-0'}/>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='start' className={'w-36'}>
                      {
                        ichTypes.map(({cate, types}, index) => (
                          <Fragment key={cate}>
                            <DropdownMenuLabel>{cate}</DropdownMenuLabel>
                            {
                              types.map((type) => (
                                <DropdownMenuCheckboxItem
                                  key={type}
                                  checked={selectedIchTypes.includes(type)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedIchTypes(types => [...types, type])
                                    } else {
                                      setSelectedIchTypes(types => types.filter(t => t !== type))
                                    }
                                  }}
                                >
                                  {type}
                                </DropdownMenuCheckboxItem>
                              ))
                            }
                            {
                              index < ichTypes.length - 1 && <DropdownMenuSeparator/>
                            }
                          </Fragment>
                        ))
                      }
                    </DropdownMenuContent>
                  </DropdownMenu>
                </FormControl>
                <FormDescription>
                  筛选文本所属的非遗类别
                </FormDescription>
                <FormMessage/>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='form'
            render={({field}) => (
              <FormItem className={'mt-2'}>
                <FormLabel>关键字</FormLabel>
                <FormControl>
                  <Input placeholder="搜索关键字" {...field} value={keyword}
                         onChange={e => setKeyword(e.target.value)}/>
                </FormControl>
              </FormItem>
            )}
          />
          <Button size='sm' className='mt-4' type="submit" onClick={() => {
            doQuery(keyword, selectedIchTypes, ichTypes.flatMap(({types}) => types))
              .then((res) => {
                setRecords(res)
              });
          }}>搜索</Button>
        </Form>
        <Separator className='my-6'/>
        <h2 className="my-2 font-bold text-2xl text-gray-700">排序层级</h2>
        <div className='flex flex-col gap-2 justify-stretch'>
          <SortableList
            items={layerOrder}
            onChange={setLayerOrder}
            renderItem={(item) => (
              <SortableList.Item id={item.id}>
                {layerName[item.id - 1]}
                <SortableList.DragHandle/>
              </SortableList.Item>
            )}
          />
        </div>
      </div>
      <div className='card h-full svg_con flex-0'>
        <Graph paths={paths} layerOrder={layerOrder.map(item => item.id - 1)} onOverPath={setHighlightingPaths}/>
      </div>
      <div className='card h-full w-1/4 flex flex-col justify-stretch'>
        <h2 className="my-2 font-bold text-2xl text-gray-700 p-4 pb-0 flex-grow-0 flex-shrink-0">文本节点</h2>
        {
          highlightingPaths.length > 0 ? (
            <Carousel className={'relative w-full flex-1 min-h-20 flex min-w-20'}>
              <CarouselContent className='h-full'>
                {
                  highlightingPaths.map((path, index) => {
                    return (
                      <CarouselItem key={index} className='overflow-auto h-full pb-4'>
                        <div className={'flex w-full gap-2 flex-col px-4'}>
                          {layerOrder.map((layer) => makeNodeCard(layer.id - 1, path[layer.id - 1], index))}
                        </div>
                      </CarouselItem>
                    )
                  })
                }
              </CarouselContent>
              <CarouselPrevious className={'absolute top-0 left-full'}
                                style={{transform: 'translate(calc(-250% - 8px), calc(-100% - 6px))'}}/>
              <CarouselNext className={'absolute top-0 right-0'}
                            style={{transform: 'translate(-50%, calc(-100% - 6px))'}}/>
            </Carousel>
          ) : (
            <div className='m-4 flex justify-center items-center flex-col h-3/4'>
              <Inbox size={40} opacity={0.7}/>
              <p className='font-medium opacity-75 mt-2'>暂无节点信息</p>
              <p className='text-sm opacity-50'>请在图表中选择查看</p>
            </div>
          )
        }
      </div>
    </main>
  );
}
