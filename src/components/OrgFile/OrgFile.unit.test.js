import {
  parseOrg,
  parseDescriptionPrefixElements,
  _parsePlanningItems,
  parseMarkupAndCookies,
} from '../../lib/parse_org';
import { exportOrg, createRawDescriptionText } from '../../lib/export_org';
import readFixture from '../../../test_helpers/index';
import { noLogRepeatEnabledP } from '../../reducers/org';
import { fromJS } from 'immutable';

/**
 * This is a convenience wrapper around parsing an org file using
 * `parseOrg` and then export it using `exportOrg`.
 * @param {String} testOrgFile - contents of an org file
 * @param {Boolean} dontIndent - by default false, so indent drawers
 */
function parseAndExportOrgFile(testOrgFile, dontIndent = false) {
  const parsedFile = parseOrg(testOrgFile);
  const exportedFile = exportOrg({
    headers: parsedFile.get('headers'),
    linesBeforeHeadings: parsedFile.get('linesBeforeHeadings'),
    dontIndent: dontIndent,
  });
  return exportedFile;
}

describe('Tests for export', () => {
  const createSimpleHeaderWithDescription = (description) =>
    fromJS({
      titleLine: undefined, // not needed
      rawDescription: description,
      description: [{ type: 'text', contents: description }],
      id: 4,
      nestingLevel: 1,
      logBookEntries: [],
      planningItems: [],
      propertyListItems: [],
    });

  test('Simple description export of empty description works', () => {
    const description = '';
    const header = createSimpleHeaderWithDescription(description);
    expect(createRawDescriptionText(header, false, false)).toEqual(description);
  });

  test('Simple description export of empty line works', () => {
    const description = '\n';
    const header = createSimpleHeaderWithDescription(description);
    expect(createRawDescriptionText(header, false, false)).toEqual(description);
  });

  test('Simple description export of non-empty line works', () => {
    const description = 'abc\n';
    const header = createSimpleHeaderWithDescription(description);
    expect(createRawDescriptionText(header, false, false)).toEqual(description);
  });

  test('Simple description export of non-empty line without trailing newline works (newline will be added)', () => {
    const description = 'abc';
    const header = createSimpleHeaderWithDescription(description);
    expect(createRawDescriptionText(header, false, false)).toEqual(`${description}\n`);
  });
});

describe('Unit Tests for Org file', () => {
  describe('Test the parser', () => {
    const expectType = (result) => expect(result.map((x) => x.type));
    describe('Parsing inline-markup', () => {
      test('Parses inline-markup where closing delim is followed by ;', () => {
        const result = parseMarkupAndCookies('*bold*;');
        expectType(result).toEqual(['inline-markup', 'text']);
      });
      test('Parses inline-markup surrounded by text', () => {
        const result = parseMarkupAndCookies(' *bold*;');
        expectType(result).toEqual(['text', 'inline-markup', 'text']);
      });
    });
  });

  describe('Parsing and export should not alter the description part', () => {
    const expectStrippedDescription = (description) => {
      const {
        planningItems,
        propertyListItems,
        logBookEntries,
        strippedDescription,
      } = parseDescriptionPrefixElements(description, fromJS([]));
      return expect(strippedDescription);
    };

    test('Parse simple description', () => {
      const description = '';
      expectStrippedDescription(description).toEqual(description);
    });

    test('Parse simple description', () => {
      const description = '\n';
      expectStrippedDescription(description).toEqual(description);
    });

    test('Parse simple description', () => {
      const description = '\nfoo';
      expectStrippedDescription(description).toEqual(description);
    });

    test('Parse simple description', () => {
      const description = '\nfoo\n';
      expectStrippedDescription(description).toEqual(description);
    });

    test('Parse simple description with planning item', () => {
      const description = 'DEADLINE: <2020-01-01 Mon>';
      expectStrippedDescription(description).toEqual('');
    });

    test('Parse simple description with planning item', () => {
      const description = 'DEADLINE: <2020-01-01 Mon> \n';
      expectStrippedDescription(description).toEqual('');
    });

    test('Parse simple description with planning item', () => {
      const description = 'DEADLINE: <2020-01-01 Mon> \nfoo\n';
      expectStrippedDescription(description).toEqual('foo\n');
    });

    test('Parse simple description with properties', () => {
      const description = `:PROPERTIES:
:END:
`;
      expectStrippedDescription(description).toEqual('');
    });

    test('Parse simple description with properties', () => {
      const text = '\n';
      const description = `:PROPERTIES:
:END:
${text}`;
      expectStrippedDescription(description).toEqual(text);
    });

    test('Parse simple description with properties', () => {
      const text = 'abc\n';
      const description = `:PROPERTIES:
:END:
${text}`;
      expectStrippedDescription(description).toEqual(text);
    });
  });

  describe('Parsing and exporting should not alter the original file', () => {
    test("Parsing and exporting shouldn't alter the original file", () => {
      const testOrgFile = readFixture('indented_list');
      const exportedFile = parseAndExportOrgFile(testOrgFile);

      // Should have the same amount of lines. Safeguard for the next
      // expectation.
      const exportedFileLines = exportedFile.split('\n');
      const testOrgFileLines = testOrgFile.split('\n');
      expect(exportedFileLines.length).toEqual(testOrgFileLines.length);

      exportedFileLines.forEach((line, index) => {
        expect(line).toEqual(testOrgFileLines[index]);
      });
    });

    test('Parse empty file', () => {
      const testOrgFile = '';
      const exportedFile = parseAndExportOrgFile(testOrgFile);
      expect(exportedFile).toEqual(testOrgFile);
    });

    test('Parse file with one empty line', () => {
      const testOrgFile = '\n';
      const exportedFile = parseAndExportOrgFile(testOrgFile);
      expect(exportedFile).toEqual('\n');
    });

    test('Parse very basic file with description', () => {
      const testOrgFile = '* Header\n'; // only one header line, no description
      const exportedFile = parseAndExportOrgFile(testOrgFile);
      expect(exportedFile).toEqual(testOrgFile);
    });

    test('Parse very basic file with description', () => {
      const testOrgFile = '* Header\n\n'; // one empty line of description
      const exportedFile = parseAndExportOrgFile(testOrgFile);
      expect(exportedFile).toEqual(testOrgFile);
    });

    test('Parse very basic file with description', () => {
      const testOrgFile = '* Header\nabc\n'; // header with one line of description
      const exportedFile = parseAndExportOrgFile(testOrgFile);
      expect(exportedFile).toEqual(testOrgFile);
    });

    test('Parse basic file with description', () => {
      const testOrgFile = readFixture('bold_text');
      const exportedFile = parseAndExportOrgFile(testOrgFile);
      expect(exportedFile).toEqual(testOrgFile);
    });

    test('Parse basic file with list', () => {
      const testOrgFile = readFixture('indented_list');
      const exportedFile = parseAndExportOrgFile(testOrgFile);
      expect(exportedFile).toEqual(testOrgFile);
    });

    test('Parses and exports a file which contains all features of organice', () => {
      const testOrgFile = readFixture('all_the_features');
      const exportedFile = parseAndExportOrgFile(testOrgFile);
      expect(exportedFile).toEqual(testOrgFile);
    });

    describe('Boldness', () => {
      test('Parsing lines with bold text', () => {
        const testOrgFile = readFixture('bold_text');
        const exportedFile = parseAndExportOrgFile(testOrgFile);
        expect(exportedFile).toEqual(testOrgFile);
      });
    });

    describe('Parsing inline-markup', () => {
      test('Parses inline-markup where closing delim is followed by ;', () => {
        const result = parseMarkupAndCookies('*bold*;');
        expect(result.length).toEqual(2);
      });
    });

    describe('HTTP URLs', () => {
      test('Parse a line containing an URL but no /italic/ text before the URL', () => {
        const testOrgFile = readFixture('url');
        const exportedFile = parseAndExportOrgFile(testOrgFile);
        expect(exportedFile).toEqual(testOrgFile);
      });
    });

    describe('www URLs', () => {
      const testOrgFile = readFixture('www_url');
      test('Parse a line containing an URL starting with www', () => {
        const exportedFile = parseAndExportOrgFile(testOrgFile);
        expect(exportedFile).toEqual(testOrgFile);
      });
      test('Parses all valid URLs starting with www', () => {
        const parsedFile = parseOrg(testOrgFile);
        const firstHeader = parsedFile.get('headers').first();
        const parsedUrls = firstHeader
          .get('description')
          .filter((x) => x.get('type') === 'www-url');
        expect(parsedUrls.size).toEqual(2);
      });
    });

    describe('E-mail address', () => {
      test('Parse a line containing an e-mail address', () => {
        const testOrgFile = readFixture('email');
        const exportedFile = parseAndExportOrgFile(testOrgFile);
        expect(exportedFile).toEqual(testOrgFile);
      });
    });

    describe('Phone number in canonical format (+xxxxxx)', () => {
      test('Parse a line containing a phone number but no +striked+ text after the number', () => {
        const testOrgFile = readFixture('phonenumber');
        const exportedFile = parseAndExportOrgFile(testOrgFile);
        expect(exportedFile).toEqual(testOrgFile);
      });
    });

    describe('Newlines', () => {
      test('Newlines in between headers and items are preserved', () => {
        const testOrgFile = readFixture('newlines');
        const exportedFile = parseAndExportOrgFile(testOrgFile);
        expect(exportedFile).toEqual(testOrgFile);
      });
    });

    test('Config and content lines before first heading line are kept', () => {
      const testOrgFile = readFixture('before-first-headline');
      const exportedFile = parseAndExportOrgFile(testOrgFile);
      expect(exportedFile).toEqual(testOrgFile);
    });

    describe('Planning items', () => {
      describe('Formatting is the same as in Emacs', () => {
        describe('List formatting', () => {
          test('Parsing a basic list should not mangle the list', () => {
            const testDescription = '  - indented list\n     - Foo';
            const parsedFile = _parsePlanningItems(testDescription);
            expect(parsedFile.strippedDescription).toEqual(testDescription);
          });

          test('Parsing a list with planning items should not mangle the list', () => {
            const testDescription = '  - indented list\n     - Foo';
            const parsedFile = _parsePlanningItems(
              `SCHEDULED: <2019-07-30 Tue>\n${testDescription}`
            );
            expect(parsedFile.strippedDescription).toEqual(testDescription);
          });

          test('Parsing planning items must not consume leading spaces in description', () => {
            const description = '  - list item';
            const { strippedDescription } = _parsePlanningItems(description);
            expect(strippedDescription).toEqual(description);
          });

          test('Parsing planning items must not consume leading spaces in description', () => {
            const description = '  - list item';
            const completeDescription = `SCHEDULED: <2020-01-01> \n${description}`;
            const { strippedDescription } = _parsePlanningItems(completeDescription);
            expect(strippedDescription).toEqual(description);
          });

          test('Parsing planning items must only consume one trailing newline', () => {
            const description = '\n\nabc';
            const completeDescription = `SCHEDULED: <2020-01-01> \n${description}`;
            const { strippedDescription } = _parsePlanningItems(completeDescription);
            expect(strippedDescription).toEqual(description);
          });

          test('Parsing planning items should not discard an empty line of description text', () => {
            const testOrgFile = `* Header
  SCHEDULED: <2019-07-30 Tue>

* Header 2
`;
            const exportedFile = parseAndExportOrgFile(testOrgFile);
            expect(exportedFile).toEqual(testOrgFile);
          });

          test('Parsing planning items must exactly consume one trailing newline', () => {
            const description = 'abc\n';
            const completeDescription = `

SCHEDULED: <2020-01-01 Wed>
${description}`;
            const { strippedDescription } = _parsePlanningItems(completeDescription);
            expect(strippedDescription).toEqual(description);
          });

          test('Parsing planning items should not add an empty line of description text', () => {
            const testOrgFile = `* Header
  SCHEDULED: <2019-07-30 Tue>
* Header 2
`;
            const exportedFile = parseAndExportOrgFile(testOrgFile);
            expect(exportedFile).toEqual(testOrgFile);
          });
        });

        describe('Planning items are formatted as is default Emacs', () => {
          test('For basic files', () => {
            const testOrgFile = readFixture('schedule');
            const exportedFile = parseAndExportOrgFile(testOrgFile);
            expect(exportedFile).toEqual(testOrgFile);
          });

          test('For basic files', () => {
            const testOrgFile = readFixture('multiple_headlines_with_timestamps');
            const exportedFile = parseAndExportOrgFile(testOrgFile);
            expect(exportedFile).toEqual(testOrgFile);
          });

          test('For files with multiple planning items', () => {
            const testOrgFile = readFixture('schedule_and_deadline');
            const exportedFile = parseAndExportOrgFile(testOrgFile);
            expect(exportedFile).toEqual(testOrgFile);
          });
        });

        test('Properties are formatted as is default in Emacs', () => {
          const testOrgFile = readFixture('properties');
          const exportedFile = parseAndExportOrgFile(testOrgFile);
          expect(exportedFile).toEqual(testOrgFile);
        });

        test('Properties are flush-left when dontIndent is true', () => {
          const testOrgFile = readFixture('properties');
          const exportedLines = parseAndExportOrgFile(testOrgFile, true).split('\n');
          expect(exportedLines[2]).toEqual(':PROPERTIES:');
        });

        test('Tags are formatted as is default in Emacs', () => {
          const testOrgFile = readFixture('tags');
          const exportedFile = parseAndExportOrgFile(testOrgFile);
          expect(exportedFile).toEqual(testOrgFile);
        });
      });
    });
    describe('Logbook entries', () => {
      test('Logbook entries are formatted as is default in Emacs', () => {
        const testOrgFile = readFixture('logbook');
        const exportedFile = parseAndExportOrgFile(testOrgFile);
        expect(exportedFile).toEqual(testOrgFile);
      });
      test('Logbook entries are indented by default', () => {
        const testOrgFile = readFixture('logbook');
        const exportedLines = parseAndExportOrgFile(testOrgFile).split('\n');
        expect(exportedLines[1]).toEqual('  :LOGBOOK:');
        expect(exportedLines[2].startsWith('  CLOCK:')).toBeTruthy();
      });
      test('Logbook entries are not indented when dontIndent', () => {
        const testOrgFile = readFixture('logbook');
        const exportedLines = parseAndExportOrgFile(testOrgFile, true).split('\n');
        expect(exportedLines[1]).toEqual(':LOGBOOK:');
        expect(exportedLines[2].startsWith('CLOCK:')).toBeTruthy();
      });
    });
  });

  describe('Reducers and helper functions', () => {
    describe('"nologrepeat" configuration', () => {
      test('Detects "nologrepeat" when set in #+STARTUP as only option', () => {
        const testOrgFile = readFixture('schedule_with_repeater_and_nologrepeat');
        const state = parseOrg(testOrgFile);
        expect(noLogRepeatEnabledP({ state, headerIndex: 0 })).toBe(true);
      });
      test('Detects "nologrepeat" when set in #+STARTUP with other options', () => {
        const testOrgFile = readFixture('schedule_with_repeater_and_nologrepeat_and_other_options');
        const state = parseOrg(testOrgFile);
        expect(noLogRepeatEnabledP({ state, headerIndex: 0 })).toBe(true);
      });
      test('Does not detect "nologrepeat" when not set', () => {
        const testOrgFile = readFixture('schedule_with_repeater');
        const state = parseOrg(testOrgFile);
        expect(noLogRepeatEnabledP({ state, headerIndex: 0 })).toBe(false);
      });
      test('Detects "nologrepeat" when set via a property list', () => {
        const testOrgFile = readFixture('schedule_with_repeater_and_nologrepeat_property');
        const state = parseOrg(testOrgFile);
        expect(noLogRepeatEnabledP({ state, headerIndex: 1 })).toBe(true);
        expect(noLogRepeatEnabledP({ state, headerIndex: 2 })).toBe(true);
        expect(noLogRepeatEnabledP({ state, headerIndex: 5 })).toBe(false);
        expect(noLogRepeatEnabledP({ state, headerIndex: 7 })).toBe(true);
      });
    });
  });

  describe('TODO keywords at EOF', () => {
    test('formatted as in default emacs', () => {
      const testOrgFile = readFixture('todo_keywords_interspersed');
      const exportedFile = parseAndExportOrgFile(testOrgFile);
      expect(exportedFile).toEqual(testOrgFile);
    });
  });
});
