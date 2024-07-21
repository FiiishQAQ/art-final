'use client'

import {estDriver} from "@/lib/neo4j";

export async function doQuery(keyword: string, selectedIchTypes: string[], defaultTypes: string[]) {
  const {records, summary, keys} = await estDriver.executeQuery(
    `
      match p=(n)-[*1..6]->(n1:ns0__artisticFeatureSubject)
      where n.ns1__name in $selectedIchTypes
      ${keyword ? 'AND ANY(x IN nodes(p) WHERE ANY(prop IN keys(x) WHERE x[prop] CONTAINS $keyword))' : ''}
      return p
      `,
    // 'MATCH (n:ns0__artisticFeatureBrocade) RETURN n LIMIT 25',
    {
      selectedIchTypes: selectedIchTypes.length > 0 ? selectedIchTypes : defaultTypes,
      keyword
    },
    {database: 'neo4j'}
  )

  // console.log('query res', records.values(), records, summary, keys);

  return records.map((record: any) => ({p: record._fields[0]}))
}
