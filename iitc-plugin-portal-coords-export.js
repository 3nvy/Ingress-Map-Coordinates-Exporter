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

  /*********** Menu ************************************************************/
  window.plugin.exportcoords.createmenu = function () {
    var shape = window.plugin.exportcoords.getFirstShape();
    var html = `
    <p> Export from <b> Current View </b> or <b> inside Polygon </b> to CSV Format </p>
    <p> Please note that the first drawn polygon will be choosen to export from. </p>

    <div class="flexed-box">
    <a onclick=\"window.plugin.exportcoords.export('CSV','VIEW');\" title='Export Portal Coordinates From ViewPort'>Export Current View</a>
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

    var checkOnPolygon = source === "VIEWFIL" && shape.type === "polygon";
    var checkOnCircle = source === "VIEWFIL" && shape.type === "circle";

    var portals = Object.values(window.portals);
    var bounds = window.map.getBounds();

    console.log(
      checkOnPolygon ? "POLYGON" : checkOnCircle ? "CIRCLE" : "VIEWPORT"
    );

    var allowedPortals = portals
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
          .flexed-box > a:first-child { margin-bottom: 10px }
          @media only screen and (max-width: 600px) {
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
