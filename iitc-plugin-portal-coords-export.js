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
    var html = `
    <p> Export from <b> Current View </b> or <b> inside Polygon </b> to CSV Format </p>
    <p> Please note that the first drawn polygon will be choosen to export from. </p>

    <div class="flexed-box">
    <a onclick=\"window.plugin.exportcoords.export('CSV','VIEW');\" title='Export Portal Coordinates From ViewPort'>Export Current View</a>
    ${
      plugin.drawTools && window.plugin.exportcoords.getFirstPolygon()
        ? `<a onclick=\"window.plugin.exportcoords.export('CSV','VIEWFIL');\" title='Export Portal Coordinates From Polygon'>Export Polygon</a>`
        : "<span>No polygon available for extraction</span>"
    }
    </div>
    `;

    window.dialog({
      title: "Export Options",
      html,
      dialogClass: "ui-dialog-exportcoords",
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

  window.plugin.exportcoords.getFirstPolygon = function () {
    try {
      return JSON.parse(localStorage["plugin-draw-tools-layer"])[0];
    } catch (err) {
      return;
    }
  };

  /*********** ABSTRACT EXPORT FUNCTION ******************************************/
  window.plugin.exportcoords.export = function (type, source) {
    var { portalinpolygon, portalinviewport } = window.plugin.exportcoords;
    var polygon = window.plugin.exportcoords.getFirstPolygon();
    var checkOnPolygon = source === "VIEWFIL" && polygon;
    var portals = Object.values(window.portals);
    var bounds = window.map.getBounds();

    var allowedPortals = portals
      .filter((p) => {
        var latlng = `${p._latlng.lat},${p._latlng.lng}`;

        return checkOnPolygon
          ? portalinpolygon(latlng, polygon.latLngs)
          : portalinviewport(p._latlng.lat, p._latlng.lng, bounds);
      })
      .map((p) => `${p._latlng.lat},${p._latlng.lng}`);

    var ostr = allowedPortals.join("\n");

    var dialog = window
      .dialog({
        title: "Exported Coordinates",
        dialogClass: "ui-dialog-maxfieldexport",
        html: `
         <textarea readonly id="idmExport" style="resize: none; width: 600px; height:${
           $(window).height() / 3
         }px; margin-top: 5px;"></textarea>
         <p><a onclick=\"$('.ui-dialog-maxfieldexport textarea').select();\">Select all</a></p>
        `,
      })
      .parent();

    dialog.css("width", 630).css({
      top: ($(window).height() - dialog.height()) / 2,
      left: ($(window).width() - dialog.width()) / 2,
    });

    $("#idmExport").val(ostr);
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
          .ui-dialog-exportcoords { width: 400px !important }
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
