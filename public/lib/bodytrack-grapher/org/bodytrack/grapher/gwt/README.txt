I deleted the following from gwt_standard.css, standard.css, and standard_rtl.css:

   body, table td, select {
      font-family: Arial Unicode MS, Arial, sans-serif;
      font-size: small;
   }

   pre {
      font-family: "courier new", courier;
      font-size: small;
   }

   body {
      color: black;
      margin: 0px;
      border: 0px;
      padding: 0px;
      background: #fff;
      direction: ltr;
   }

   a, a:visited, a:hover {
      color: #0000AA;
   }

Because of how GWT loads, the above styles were stomping all over mine. The
GWT developer who decided that was a good idea should find a new career.