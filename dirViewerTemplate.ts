
import { EntryInfo } from "./types.ts";

function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  const l = strings.length - 1;
  let html = "";

  for (let i = 0; i < l; i++) {
    let v = values[i];
    if (v instanceof Array) {
      v = v.join("");
    }
    const s = strings[i] + v;
    html += s;
  }
  html += strings[l];
  return html;
}

export default (dirname: string, entries: EntryInfo[]) => {
  return html`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Index of ${dirname}</title>
        <style>
          @media (min-width: 960px) {
            main {
              max-width: 960px;
            }
            body {
              padding-left: 32px;
              padding-right: 32px;
            }
          }
          @media (min-width: 600px) {
            main {
              padding-left: 24px;
              padding-right: 24px;
            }
          }
          a {
            color: #2196f3;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          table th {
            text-align: left;
          }
          table td {
            padding: 12px 24px 0 0;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>Index of ${dirname}</h1>
          <table>
            <tr>
              <th>Size</th>
              <th>Name</th>
            </tr>
            ${
    entries.map(
      (entry) =>
        html`
                  <tr>
                    <td>
                      ${entry.size}
                    </td>
                    <td>
                      <a href="${entry.url}">${entry.name}</a>
                    </td>
                  </tr>
                `,
    )
  }
          </table>
        </main>
      </body>
    </html>
  `;
}