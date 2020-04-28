// ==UserScript==
// @id              iitc-plugin-portal-coords-export
// @name            IITC plugin: Portal Coords Export
// @category        Misc
// @version         1
// @namespace       https://gitlab.com/3nvy/ingress-coords-exporter
// @description     Export portals from current view or polygon
// @include         http*://*intel.ingress.com/*
// @match           http*://*intel.ingress.com/*
// @grant           none
// ==/UserScript==

function wrapper(plugin_info) {
  // ensure plugin framework is there, even if iitc is not yet loaded
  if (typeof window.plugin !== "function") window.plugin = function () {};

  window.plugin.exportcoords = function () {};

  window.plugin.exportcoords.setupCallback = function () {
    if (!localStorage["selectiveCoordsList"])
      localStorage["selectiveCoordsList"] = "[]";

    addHook("portalDetailsUpdated", window.plugin.exportcoords.addLink);
    window.plugin.exportcoords.refreshSelectedCoordinatesList();

    window.plugin.exportcoords.drawSelectedCoordsPolyline();
  };

  /*********** Selected Coordinates ************************************************************/
  window.plugin.exportcoords.addLink = function (d) {
    $(".linkdetails").append(
      `<aside><a onclick=\"window.plugin.exportcoords.addToList('${window.selectedPortal}')" title="Display raw data of the portal">Add for Selective Export</a></aside>`
    );
  };

  window.plugin.exportcoords.addToList = function (guid) {
    if (!window.portals[guid]) {
      console.warn`Error: failed to find portal details for guid ${guid} - failed to show debug data`;
      return;
    }

    const selectiveCoordsList = JSON.parse(localStorage["selectiveCoordsList"]);
    var { latE6, lngE6, image, title } = window.portals[guid].options.data;

    console.log(window.portals[guid].options.data);

    if (selectiveCoordsList.find((p) => p.guid === guid)) return;
    selectiveCoordsList.push({
      guid,
      lat: latE6 / 1000000,
      lng: lngE6 / 1000000,
      image,
      title,
    });

    localStorage["selectiveCoordsList"] = JSON.stringify(selectiveCoordsList);
    window.plugin.exportcoords.refreshSelectedCoordinatesList();
  };

  window.plugin.exportcoords.removeFromList = function (guid) {
    console.log(guid);
    var selectiveCoordsList = JSON.parse(localStorage["selectiveCoordsList"]);
    var portals = selectiveCoordsList.filter((p) => p.guid !== guid);

    localStorage["selectiveCoordsList"] = JSON.stringify(portals);
    window.plugin.exportcoords.refreshSelectedCoordinatesList();
  };

  window.plugin.exportcoords.clearSelectedCoordinates = function () {
    localStorage["selectiveCoordsList"] = "[]";
    window.plugin.exportcoords.refreshSelectedCoordinatesList();
  };

  window.plugin.exportcoords.drawSelectedCoordsPolyline = function () {
    if (window.plugin.exportcoords.selectedCoordsPolyline)
      window.plugin.exportcoords.selectedCoordsPolyline.remove();

    var selectiveCoordsList = JSON.parse(localStorage["selectiveCoordsList"]);
    var pointList = selectiveCoordsList.map(
      ({ lat, lng }) => new L.LatLng(lat, lng)
    );

    window.plugin.exportcoords.selectedCoordsPolyline = new L.Polyline(
      pointList,
      {
        color: "red",
        weight: 3,
        opacity: 0.5,
        smoothFactor: 1,
      }
    );
    window.plugin.exportcoords.selectedCoordsPolyline.addTo(map);
  };

  window.plugin.exportcoords.refreshSelectedCoordinatesList = function () {
    var selectiveCoordsList = JSON.parse(localStorage["selectiveCoordsList"]);
    const firstEntries = selectiveCoordsList;

    var html = firstEntries.map(
      ({ image, title, guid }) => `
    <div class="selected-coords-content">
      <div class="selected-coords-content-info">
        <img src="${image.replace("http:", "")}">
        <span>${title}</span>
      </div>
      <div class="selected-coords-content-controls">
        <a onclick="window.plugin.exportcoords.removeFromList('${guid}')" title="Remove Portal">X</a>
      </div>
    </div>
    `
    );

    $("#selected-coordinates-mini").html(html);

    window.plugin.exportcoords.drawSelectedCoordsPolyline();
  };

  /*********** Menu ************************************************************/
  window.plugin.exportcoords.createmenu = function () {
    var shape = window.plugin.exportcoords.getFirstShape();
    var html = `
    <p> Export from <b> Current View </b> or <b> inside Polygon </b> to CSV Format </p>
    <p> Please note that the first drawn polygon will be choosen to export from. </p>

    <div class="flexed-box">
    <a onclick=\"window.plugin.exportcoords.export('CSV','VIEW');\" title='Export Portal Coordinates From ViewPort'>Export Current View</a>
    ${
      JSON.parse(localStorage["selectiveCoordsList"]).length !== 0
        ? `<a onclick=\"window.plugin.exportcoords.export('CSV','SELECTED');\" title='Export Selected Portal Coordinates'>Export Selected</a>`
        : ""
    }
    ${
      plugin.drawTools && shape && shape.type === "polygon"
        ? `<a onclick=\"window.plugin.exportcoords.export('CSV','VIEWFIL');\" title='Export Portal Coordinates From Polygon'>Export Polygon</a>`
        : plugin.drawTools && shape && shape.type === "circle"
        ? `<a onclick=\"window.plugin.exportcoords.export('CSV','VIEWFIL');\" title='Export Portal Coordinates From Circle'>Export Circle</a>`
        : "<span>No polygon available for extraction</span>"
    }
    </div>
    `;

    var dialog = window.dialog({
      title: "Export Options",
      html,
      dialogClass: "ui-dialog-createmenu",
    });

    dialog.css({
      "max-width": $(window).width() - dialog.width() - 20,
    });
  };

  /*********** HELPER FUNCTION ****************************************************/
  window.plugin.exportcoords.portalinpolygon = function (
    portal,
    PolygonCoordinates
  ) {
    var [x, y] = portal.split(",");

    var inside = false;
    for (
      var i = 0, j = PolygonCoordinates.length - 1;
      i < PolygonCoordinates.length;
      j = i++
    ) {
      var xi = PolygonCoordinates[i]["lat"],
        yi = PolygonCoordinates[i]["lng"];
      var xj = PolygonCoordinates[j]["lat"],
        yj = PolygonCoordinates[j]["lng"];

      var intersect =
        yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  };

  window.plugin.exportcoords.portalincircle = function (
    portal,
    { latLng: { lat: cx, lng: cy }, radius }
  ) {
    var [x, y] = portal.split(",");

    var ky = 40000 / 360;
    var kx = Math.cos((Math.PI * cx) / 180.0) * ky;
    var dx = Math.abs(cy - y) * kx;
    var dy = Math.abs(cx - x) * ky;
    return Math.sqrt(dx * dx + dy * dy) <= radius / 1000;
  };

  window.plugin.exportcoords.portalinviewport = function (
    pLat,
    pLng,
    viewport
  ) {
    return (
      pLat < viewport._southWest.lat ||
      pLng < viewport._southWest.lng ||
      pLat > viewport._northEast.lat ||
      pLng > viewport._northEast.lng
    );
  };

  window.plugin.exportcoords.getFirstShape = function () {
    try {
      return JSON.parse(localStorage["plugin-draw-tools-layer"])[0];
    } catch (err) {
      return;
    }
  };

  /*********** ABSTRACT EXPORT FUNCTION ******************************************/
  window.plugin.exportcoords.export = function (type, source) {
    var {
      portalinpolygon,
      portalinviewport,
      portalincircle,
    } = window.plugin.exportcoords;
    var shape = window.plugin.exportcoords.getFirstShape();

    var checkOnSelected = source === "SELECTED";
    var checkOnPolygon = source === "VIEWFIL" && shape.type === "polygon";
    var checkOnCircle = source === "VIEWFIL" && shape.type === "circle";

    var portals = Object.values(window.portals);
    var bounds = window.map.getBounds();

    console.log(
      checkOnPolygon ? "POLYGON" : checkOnCircle ? "CIRCLE" : "VIEWPORT"
    );

    var allowedPortals;

    if (checkOnSelected) {
      allowedPortals = JSON.parse(localStorage["selectiveCoordsList"]).map(
        ({ lat, lng }) => `${lat},${lng}`
      );
    } else
      allowedPortals = portals
        .filter((p) => {
          var latlng = `${p._latlng.lat},${p._latlng.lng}`;

          return checkOnPolygon
            ? portalinpolygon(latlng, shape.latLngs)
            : checkOnCircle
            ? portalincircle(latlng, shape)
            : portalinviewport(p._latlng.lat, p._latlng.lng, bounds);
        })
        .map((p) => `${p._latlng.lat},${p._latlng.lng}`);

    var dialog = window
      .dialog({
        title: "Exported Coordinates",
        dialogClass: "ui-dialog-export",
        html: `
         <textarea readonly id="idmExport" style="resize: none; width: 600px; height:${
           $(window).height() / 3
         }px; margin-top: 5px;"></textarea>
         <p><a onclick=\"$('.ui-dialog-export textarea').select();\">Select all</a></p>
        `,
      })
      .parent();

    dialog.css({
      top: ($(window).height() - dialog.height()) / 2,
      left: ($(window).width() - dialog.width()) / 2,
    });

    $("#idmExport").val(allowedPortals.join("\n"));
  };

  /*********** PLUGIN SETUP *****************************************************/
  // setup function called by IITC
  var setup = function () {
    $("#toolbox").append(
      '<a onclick="window.plugin.exportcoords.createmenu();" title="Export the currently visible portals">Export Coords</a>'
    );

    $("head").append(`
      <style>
          #sidebar {
            display: -webkit-box;display: -ms-flexbox;display: flex;
            -webkit-box-orient: vertical;-webkit-box-direction: normal;-ms-flex-direction: column;flex-direction: column;
          }
          #portaldetails {
            min-height: unset !important;
          }
          img.fullimg {
            display: none;
          }

          .exportcoordsSetbox > a { display:block; color:#ffce00; border:1px solid #ffce00; padding:3px 0; margin:10px auto; width:100%; text-align:center; background:rgba(8,48,78,.9); }
          .ui-dialog-createmenu { width: 400px !important }
          .ui-dialog-export { width: 600px !important; max-width: 100% }
          .ui-dialog-export textarea { 
            width: 100% !important; 
            -webkit-box-flex: 1;-ms-flex: 1;flex: 1
          }
          .flexed-box {
            display: -webkit-box;
            display: -ms-flexbox;
            display: flex;
            -webkit-box-orient: vertical;
            -webkit-box-direction: normal;
            -ms-flex-direction: column;
            flex-direction: column;
            -webkit-box-align: center;
            -ms-flex-align: center;
            align-items: center;
          }
          .flexed-box > a { margin-bottom: 10px }

          .selected-coords-content-info,
          .selected-coords-content { 
            display: -webkit-box;
            display: -ms-flexbox;
            display: flex;
            -webkit-box-align: center;
            -ms-flex-align: center;
            align-items: center;
            -webkit-box-ordinal-group: 2;-ms-flex-order: 1;order: 1
           }
          .selected-coords-content img { width: 35px; height: 35px; margin-right: 10px }

          .selected-coords-content-controls {
            -webkit-box-ordinal-group: 1;-ms-flex-order: 0;order: 0
          }

          .selected-coords-content-controls a{
            margin: 0 10px
          }

          #selectedCoordsBox {
            position: relative;
            display: block !important;
            overflow-y: scroll;
          }

          #selected-coordinates-mini {
            margin-bottom: 7px;
          }

          @media only screen and (max-width: 600px) {
            #selectedCoordsBox {
              overflow-y: unset;
            }
            .ui-dialog-export {
              top: 0 !important;
              height: 100% !important;
            }
            .ui-dialog-export .ui-dialog-content {
              display: -webkit-box;
              display: -ms-flexbox;
              display: flex;
              -webkit-box-orient: vertical;
              -webkit-box-direction: normal;
              -ms-flex-direction: column;
              flex-direction: column;
              height: 80% !important;
              max-height: unset !important;
            }
          }
      </style>
    `);

    var selectedCoordsBox = `
    <div id="selectedCoordsBox" style="position: relative;">
        <p style="margin: 5px 0 5px 0; text-align: center; font-weight: bold;">Selected Coordinates</p>
        <a id="startScraper" style="position: absolute; top: 5px; left: 0; margin: 0 5px 0 5px;" onclick="window.plugin.exportcoords.clearSelectedCoordinates()" title="Clear Selected Coordinates">Clear</a>
        <div id="selected-coordinates-mini"></div>
    </div>
    `;

    $(selectedCoordsBox).insertBefore("#toolbox");

    window.plugin.exportcoords.setupCallback();
  };

  setup.info = plugin_info; //add the script info data to the function as a property
  if (!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);
  // if IITC has already booted, immediately run the 'setup' function
  if (window.iitcLoaded && typeof setup === "function") setup();
} // wrapper end
// inject code into site context
var script = document.createElement("script");
var info = {};
if (typeof GM_info !== "undefined" && GM_info && GM_info.script)
  info.script = {
    version: GM_info.script.version,
    name: GM_info.script.name,
    description: GM_info.script.description,
  };
script.appendChild(
  document.createTextNode("(" + wrapper + ")(" + JSON.stringify(info) + ");")
);
(document.body || document.head || document.documentElement).appendChild(
  script
);
