import { auth, driver, Driver } from "neo4j-driver"

// URI examples: 'neo4j://localhost', 'neo4j+s://xxx.databases.neo4j.io'
const URI = 'neo4j://localhost'
const USER = 'neo4j'
const PASSWORD = ''
let estDriver: Driver;

try {
  estDriver = driver(URI, auth.basic(USER, PASSWORD));
  estDriver.getServerInfo().then((info) => {
    console.log('Connection established')
    console.log(info)
  })
} catch(err: any) {
  console.log(`Connection error\n${err}\nCause: ${err.cause}`)
}

export {estDriver};
