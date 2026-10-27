COMPILE USL mission_intelligence_v1 DEPLOY NAMESPACE lightning.metastore.portalone DDL
CREATE TABLE communities (
  place_id varchar(200) NOT NULL PRIMARY KEY,
  name varchar(200),
  map_revision varchar(200)
);
CREATE TABLE depots (
  depot_id varchar(200) NOT NULL PRIMARY KEY,
  stock_units bigint,
  available_vehicles bigint,
  stock_expires_at varchar(200),
  simulated boolean
);
CREATE TABLE community_logistics (
  place_id varchar(200) NOT NULL PRIMARY KEY FOREIGN KEY REFERENCES communities(place_id),
  depot_id varchar(200) FOREIGN KEY REFERENCES depots(depot_id),
  simulated boolean
);
CREATE TABLE route_options (
  route_id varchar(200) NOT NULL PRIMARY KEY,
  depot_id varchar(200) FOREIGN KEY REFERENCES depots(depot_id),
  distance_km double,
  travel_minutes bigint,
  max_gross_kg double,
  expires_at varchar(200),
  simulated boolean
)
