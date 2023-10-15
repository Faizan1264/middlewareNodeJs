const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
app.use(express.json());
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeAndDbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB error , ${e.message}`);
    process.exit(1);
  }
};

initializeAndDbServer();

const convertToJsonState = (dbObject) => {
  return {
    stateName: dbObject.state_name,
    stateId: dbObject.state_id,
    population: dbObject.population,
  };
};
const convertToJsonDistrict = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

///login/

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authentication"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}
app.post("/login/", async (request, response) => {
  const { username, name, password } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const checkUsername = ` SELECT * FROM user WHERE username = '${username}'`;
  const databaseUser = await db.get(checkUsername);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isMatchedPassword = await bcrypt.compare(
      password,
      databaseUser.password
    );
    if (isMatchedPassword === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_KEY");
      response.send(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//GET
app.get("/states/", authenticateToken, async (request, response) => {
  const sqlQuery = `
    SELECT * 
    FROM state 
    ORDER BY 
    state_id;`;

  const stateArray = await db.all(sqlQuery);
  response.send(
    stateArray.map((eachState) => {
      return convertToJsonState(eachState);
    })
  );
});
///states/:stateId/
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const sqlQuery = `
    SELECT * 
    FROM state 
    WHERE 
    state_id = ${stateId};
    
    `;
  const state = await db.get(sqlQuery);
  const result = convertToJsonState(state);
  response.send(result);
});

///districts/
app.post("/districts/", authenticateToken, async (request, response) => {
  const { stateId, districtName, cases, cured, active, deaths } = request.body;
  const sqlQuery = `
    INSERT INTO 
    district (state_id , district_name , cases , cured , active , deaths)
    VALUES (
        ${stateId},'${districtName}', ${cases}, ${cured}, ${active}, ${deaths}
    );
    
    `;
  await db.run(sqlQuery);
  response.send("District Successfully Added");
});
///districts/:districtId/
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const sqlQuery = `
    SELECT * FROM district

    WHERE 
    district_id = ${districtId};`;
    const arrayDistrict = await db.all(sqlQuery);
    response.send(
      arrayDistrict.map((eachDistrict) => {
        return convertToJsonDistrict(eachDistrict);
      })
    );
  }
);
///districts/:districtId/
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const sqlQuery = `
    DELETE FROM district 
    WHERE 
    district_id = ${districtId};
    
    `;
    await db.run(sqlQuery);
    response.send("District Removed");
  }
);
///districts/:districtId/
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const sqlQuery = `
    UPDATE district 
    SET 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases =  ${cases},
    cured =  ${cured},
    active =  ${active},
    deaths =  ${deaths}

   WHERE 
   district_id = ${districtId};
    
    `;
    await db.run(sqlQuery);
    response.send("District Details Updated");
  }
);

///states/:stateId/stats/
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const sqlQuery = `
    SELECT SUM(cases)  as totalCases,
    SUM(cured)  as totalCured,
    SUM(active)  as totalActive,
    SUM(deaths)  as totalDeaths

    FROM state
    WHERE 
    state_id = ${stateId};`;
    const result = await db.get(sqlQuery);
    response.send(result);
  }
);

module.exports = app;
