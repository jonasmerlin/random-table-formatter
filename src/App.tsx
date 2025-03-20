import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "./components/ui/textarea";
import { TypographyH1 } from "./components/TypographyH1";
import {
  Clipboard,
  Save,
  Trash2,
  RefreshCw,
  Eraser,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "motion/react";
import { TypographyH2 } from "./components/TypographyH2";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Constants
const TOAST_DURATION = 5000;
const MAX_INPUT_LENGTH = 50000;

interface SavedTable {
  id: string;
  name: string;
  input: string;
  output: string;
  columnSettings: {
    detectColumns: boolean;
    columnCount: number;
    columnDelimiter: string;
    outputFormat: "tab" | "csv" | "markdown" | "aligned";
    showLineNumbers: boolean;
  };
  createdAt: string;
}

const TableFormatter = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [savedTables, setSavedTables] = useState<SavedTable[]>([]);
  const [tableName, setTableName] = useState("");
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [columnDelimiter, setColumnDelimiter] = useState<string>("\t");
  const [detectColumns, setDetectColumns] = useState<boolean>(false);
  const [columnCount, setColumnCount] = useState<number>(2);
  const [outputFormat, setOutputFormat] = useState<
    "tab" | "csv" | "markdown" | "aligned" | undefined
  >(undefined);

  const delimiterOptions = [
    { value: "\t", label: "Tab" },
    { value: ",", label: "Comma" },
    { value: "|", label: "Pipe" },
    { value: ";", label: "Semicolon" },
    { value: " ", label: "Space" },
  ];

  // Load saved tables on component mount
  useEffect(() => {
    const loadSavedTables = () => {
      try {
        const storedTables = localStorage.getItem("formattedTables");
        if (storedTables) {
          setSavedTables(JSON.parse(storedTables));
        }
      } catch (error) {
        console.error("Error loading saved tables:", error);
        toast.error("Failed to load saved tables", {
          duration: TOAST_DURATION,
        });
      }
    };

    loadSavedTables();
  }, []);

  // Save tables to localStorage with error handling
  const saveTablestoStorage = useCallback((tables: SavedTable[]) => {
    try {
      localStorage.setItem("formattedTables", JSON.stringify(tables));
      return true;
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      toast.error("Failed to save tables to storage", {
        duration: TOAST_DURATION,
      });
      return false;
    }
  }, []);

  // Format table logic extracted to avoid circular dependencies
  const formatTableText = useCallback(
    (text: string, withLineNumbers: boolean): string => {
      if (!text.trim()) {
        return "";
      }

      // Split by line breaks first
      const lines = text.split("\n").filter((line) => line.trim() !== "");

      // Initialize array for table data with row arrays
      const tableData: string[][] = [];

      // Process each line
      for (const line of lines) {
        // First check if line already has the delimiter
        if (detectColumns && line.includes(columnDelimiter)) {
          // Line already has columns, split by the delimiter
          const rowData = line
            .split(columnDelimiter)
            .map((cell) => cell.trim());

          // If it has a number prefix in the first column, strip it
          const firstCellMatch = rowData[0].match(
            /^\s*(\d+)(?:\s+|\.\s*|\\-\s*)(.*)/,
          );
          if (firstCellMatch && firstCellMatch[2]) {
            rowData[0] = firstCellMatch[2].trim();
          }

          tableData.push(rowData);
        } else {
          // For non-delimited lines
          const numberPrefixMatch = line.match(
            /^\s*(\d+)(?:\s+|\.\s*|\\-\s*)(.*)/,
          );

          if (numberPrefixMatch && numberPrefixMatch[2]) {
            // Line with number prefix
            const content = numberPrefixMatch[2].trim();

            // Check if we can split the content into columns
            if (detectColumns) {
              // Try to split by common delimiters if none specified
              const possibleDelimiters = ["\t", ",", "|", ";"];
              let rowData: string[] = [content];

              for (const delimiter of possibleDelimiters) {
                if (content.includes(delimiter)) {
                  rowData = content.split(delimiter).map((cell) => cell.trim());
                  break;
                }
              }

              tableData.push(rowData);
            } else {
              // Single column mode
              tableData.push([content.trim()]);
            }
          } else if (line.trim()) {
            // Line without number prefix
            if (detectColumns) {
              // Try to split by common delimiters
              const possibleDelimiters = ["\t", ",", "|", ";"];
              let rowData: string[] = [line.trim()];

              for (const delimiter of possibleDelimiters) {
                if (line.includes(delimiter)) {
                  rowData = line.split(delimiter).map((cell) => cell.trim());
                  break;
                }
              }

              tableData.push(rowData);
            } else {
              tableData.push([line.trim()]);
            }
          }
        }
      }

      // If we're in manual column mode and not detecting columns
      if (!detectColumns && columnCount > 1) {
        // Ensure each row has the specified number of columns
        tableData.forEach((row) => {
          while (row.length < columnCount) {
            row.push(""); // Add empty cells as needed
          }

          if (row.length > columnCount) {
            row.splice(columnCount); // Truncate if too many columns
          }
        });
      }

      // Format the table data based on the selected output format
      return formatOutput(tableData, withLineNumbers, outputFormat);
    },
    [columnDelimiter, detectColumns, columnCount, outputFormat],
  );

  // New function to format the output based on selected format
  const formatOutput = useCallback(
    (
      tableData: string[][],
      withLineNumbers: boolean,
      format: "tab" | "csv" | "markdown" | "aligned" | undefined,
    ): string => {
      // Find the max width for each column for aligned format
      const columnWidths: number[] = [];

      if (format === "aligned") {
        // Calculate max width for each column
        tableData.forEach((row) => {
          row.forEach((cell, colIndex) => {
            columnWidths[colIndex] = Math.max(
              columnWidths[colIndex] || 0,
              cell.length,
            );
          });
        });
      }

      // Format rows
      const formattedRows = tableData.map((row, rowIndex) => {
        let formattedRow = "";

        switch (format) {
          case "tab":
            formattedRow = row.join("\t");
            // Add line numbers if enabled for tab format
            if (withLineNumbers) {
              formattedRow =
                String(rowIndex + 1).padStart(3, "0") + " " + formattedRow;
            }
            break;
          case "csv":
            formattedRow = row
              .map((cell) => {
                // Escape quotes and wrap in quotes if needed
                if (cell.includes(",") || cell.includes('"')) {
                  return `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
              })
              .join(",");
            // Add line numbers if enabled for csv format
            if (withLineNumbers) {
              formattedRow =
                String(rowIndex + 1).padStart(3, "0") + " " + formattedRow;
            }
            break;
          case "markdown":
            // For markdown, we need to handle line numbers differently to maintain valid syntax
            if (withLineNumbers) {
              // Add line number as the first column inside the table
              const rowNumber = String(rowIndex + 1).padStart(3, "0");
              formattedRow = "| " + rowNumber + " | " + row.join(" | ") + " |";

              // Add markdown header row if this is the first row
              if (rowIndex === 0 && tableData.length > 1) {
                // Include additional column for line numbers in the header separator
                const headerSeparator =
                  "| --- | " + row.map((_) => "---").join(" | ") + " |";
                formattedRow += "\n" + headerSeparator;
              }
            } else {
              // Standard markdown format without line numbers
              formattedRow = "| " + row.join(" | ") + " |";

              // Add markdown header row if this is the first row
              if (rowIndex === 0 && tableData.length > 1) {
                const headerSeparator =
                  "| " + row.map((_) => "---").join(" | ") + " |";
                formattedRow += "\n" + headerSeparator;
              }
            }
            break;
          case "aligned":
            formattedRow = row
              .map((cell, colIndex) => {
                return cell.padEnd(columnWidths[colIndex] + 2);
              })
              .join("");
            // Add line numbers if enabled for aligned format
            if (withLineNumbers) {
              formattedRow =
                String(rowIndex + 1).padStart(3, "0") + " " + formattedRow;
            }
            break;
          default:
            formattedRow = row.join("\n");
            // Add line numbers if enabled for tab format
            if (withLineNumbers) {
              formattedRow =
                String(rowIndex + 1).padStart(3, "0") + " " + formattedRow;
            }
            break;
        }

        return formattedRow;
      });

      return formattedRows.join("\n");
    },
    [],
  );

  // Wrapper function that updates the state
  const formatTable = useCallback(
    (value?: string) => {
      const textToFormat = value !== undefined ? value : input;
      const result = formatTableText(textToFormat, showLineNumbers);
      setOutput(result);
    },
    [formatTableText, showLineNumbers],
  );

  // Reformat whenever showLineNumbers changes
  useEffect(() => {
    if (input.trim()) {
      formatTable(input);
    }
  }, [showLineNumbers, formatTable, input]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(output);
      toast.success("Copied to clipboard!", {
        duration: TOAST_DURATION,
      });
    } catch {
      toast.error("Failed to copy to clipboard", {
        duration: TOAST_DURATION,
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;

    // Validate input length to prevent performance issues
    if (newValue.length > MAX_INPUT_LENGTH) {
      setInputError(
        `Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`,
      );
      return;
    }

    setInputError(null);
    setInput(newValue);
    formatTable(newValue);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Press Enter to save when input is focused
    if (e.key === "Enter") {
      e.preventDefault();
      saveToLocalStorage();
    }
  };

  const handleToggleLineNumbers = (checked: boolean | "indeterminate") => {
    // Ensure we only operate on boolean values
    const isChecked = checked === true;
    setShowLineNumbers(isChecked);
    formatTable(); // Reformat with the new setting
  };

  const clearInput = () => {
    // Store current input and output before clearing
    const previousInput = input;
    const previousOutput = output;

    // Clear the input and output
    setInput("");
    setOutput("");
    setInputError(null);

    // Show toast with undo option
    toast("Input cleared!", {
      description: "Your input has been cleared.",
      action: {
        label: "Undo",
        onClick: () => {
          // Restore the previous input and output
          setInput(previousInput);
          setOutput(previousOutput);
          toast.success("Input restored!", {
            duration: TOAST_DURATION,
          });
        },
      },
      duration: TOAST_DURATION,
    });
  };

  const saveToLocalStorage = () => {
    if (!output.trim()) {
      toast.error("Nothing to save!", {
        duration: TOAST_DURATION,
      });
      return;
    }

    if (!tableName.trim()) {
      toast.error("Please enter a name for this table", {
        duration: TOAST_DURATION,
      });
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
      return;
    }

    // Check for duplicate names
    const isDuplicate = savedTables.some(
      (table) => table.name.toLowerCase() === tableName.toLowerCase(),
    );

    if (isDuplicate) {
      toast.error("A table with this name already exists", {
        duration: TOAST_DURATION,
      });
      return;
    }

    const newTable = {
      id: Date.now().toString(),
      name: tableName,
      input,
      output,
      columnSettings: {
        detectColumns,
        columnCount,
        columnDelimiter,
        outputFormat,
        showLineNumbers,
      },
      createdAt: new Date().toISOString(),
    };

    const updatedTables = [...savedTables, newTable];
    const saveSuccess = saveTablestoStorage(updatedTables);

    if (saveSuccess) {
      setSavedTables(updatedTables);
      setTableName("");
      toast.success("Table saved successfully!", {
        duration: TOAST_DURATION,
      });
    }
  };

  const restoreTable = (tableData: SavedTable) => {
    setInput(tableData.input);

    // Restore column settings
    if (tableData.columnSettings) {
      setDetectColumns(tableData.columnSettings.detectColumns);
      setColumnCount(tableData.columnSettings.columnCount);
      setColumnDelimiter(tableData.columnSettings.columnDelimiter);
      setOutputFormat(tableData.columnSettings.outputFormat);
      setShowLineNumbers(tableData.columnSettings.showLineNumbers);
    }

    // Format with current settings
    const currentInput = tableData.input;
    if (currentInput.trim()) {
      formatTable(currentInput);
    }

    toast.success(`Restored table: ${tableData.name}`, {
      duration: TOAST_DURATION,
    });
  };

  const confirmDeleteTable = (id: string) => {
    setTableToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirmed = () => {
    if (!tableToDelete) return;

    // Find the table to be deleted and store it
    const tableToDeleteData = savedTables.find(
      (table) => table.id === tableToDelete,
    );
    if (tableToDeleteData) {
      // Store the deleted table
      const deletedTable = { ...tableToDeleteData };

      // Remove from saved tables
      const updatedTables = savedTables.filter(
        (table) => table.id !== tableToDelete,
      );
      const saveSuccess = saveTablestoStorage(updatedTables);

      if (saveSuccess) {
        setSavedTables(updatedTables);

        // Show toast with undo option
        toast("Table deleted!", {
          description: `"${deletedTable.name}" has been removed.`,
          action: {
            label: "Undo",
            onClick: () => {
              // Add the deleted table back to the saved tables
              const newUpdatedTables = [...updatedTables, deletedTable];
              const restoreSuccess = saveTablestoStorage(newUpdatedTables);

              if (restoreSuccess) {
                setSavedTables(newUpdatedTables);
                toast.success(`Restored: ${deletedTable.name}`, {
                  duration: TOAST_DURATION,
                });
              }
            },
          },
          duration: TOAST_DURATION,
        });
      }
    }

    // Reset state
    setTableToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const handleDeleteCancelled = () => {
    setTableToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  return (
    <div className="min-h-svh p-4 bg-white">
      <div className="w-full mx-auto">
        <TypographyH1>Random Table Formatter</TypographyH1>
        <div className="flex flex-col md:flex-row gap-4 items-end mt-6">
          <div className="w-full md:w-1/2">
            <Textarea
              className={`w-full min-h-96 ${inputError ? "border-red-500" : ""}`}
              value={input}
              onChange={handleInputChange}
              placeholder="Paste your random table here..."
              aria-label="Input text for formatting"
              aria-invalid={inputError ? "true" : "false"}
              aria-describedby={inputError ? "input-error" : undefined}
            />
            {inputError && (
              <div
                id="input-error"
                className="text-red-500 text-sm mt-1 flex items-center"
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                {inputError}
              </div>
            )}
          </div>
          <div className="w-full md:w-1/2">
            <Textarea
              className="w-full min-h-96"
              value={output}
              readOnly
              placeholder="Formatted output will appear here..."
              aria-label="Formatted output"
            />
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-4 justify-between mt-4">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative">
              <Input
                ref={nameInputRef}
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                placeholder="Enter table name..."
                className="w-64 pr-10"
                aria-label="Table name"
              />
            </div>
            <Button
              onClick={saveToLocalStorage}
              variant="outline"
              aria-label="Save table"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Table
            </Button>

            {/* Clear input button */}
            <Button
              onClick={clearInput}
              variant="outline"
              className="ml-2"
              aria-label="Clear input"
            >
              <Eraser className="mr-2 h-4 w-4" />
              Clear
            </Button>

            {/* Line number toggle checkbox */}
            <div className="flex items-center ml-4 space-x-2">
              <Checkbox
                id="showLineNumbers"
                checked={showLineNumbers}
                onCheckedChange={handleToggleLineNumbers}
                aria-label="Show line numbers"
              />
              <label
                htmlFor="showLineNumbers"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Add line numbers
              </label>
            </div>
          </div>
          <Button
            onClick={copyToClipboard}
            disabled={!output}
            aria-label="Copy to clipboard"
          >
            <Clipboard className="mr-2 h-4 w-4" />
            Copy to Clipboard
          </Button>
        </div>
        <div className="mt-4 p-4 border rounded-md">
          <h3 className="text-sm font-medium mb-2">Column Settings</h3>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="detectColumns"
                checked={detectColumns}
                onCheckedChange={(checked) =>
                  setDetectColumns(checked === true)
                }
                aria-label="Auto-detect columns"
              />
              <label
                htmlFor="detectColumns"
                className="text-sm font-medium leading-none"
              >
                Auto-detect columns
              </label>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      className="p-0 h-6 w-6 rounded-full"
                      aria-label="Help"
                    >
                      <span className="text-xs">?</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="w-64 text-xs">
                      When enabled, the formatter will try to detect columns
                      using common delimiters. Turn off to manually set column
                      count.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {!detectColumns && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="columnCount"
                  className="text-sm whitespace-nowrap"
                >
                  Column Count:
                </label>
                <Input
                  id="columnCount"
                  type="number"
                  min="1"
                  max="20"
                  value={columnCount}
                  onChange={(e) =>
                    setColumnCount(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-16"
                  aria-label="Number of columns"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <label
                htmlFor="columnDelimiter"
                className="text-sm whitespace-nowrap"
              >
                Column Delimiter:
              </label>
              <Select
                value={columnDelimiter}
                onValueChange={setColumnDelimiter}
              >
                <SelectTrigger className="w-32" id="columnDelimiter">
                  <SelectValue placeholder="Delimiter" />
                </SelectTrigger>
                <SelectContent>
                  {delimiterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="outputFormat"
                className="text-sm whitespace-nowrap"
              >
                Output Format:
              </label>
              <Select
                value={outputFormat}
                onValueChange={(value) =>
                  setOutputFormat(
                    value as "tab" | "csv" | "markdown" | "aligned",
                  )
                }
              >
                <SelectTrigger className="w-32" id="outputFormat">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aligned">Aligned</SelectItem>
                  <SelectItem value="tab">Tab</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Saved Tables Section with optimized AnimatePresence */}
        {savedTables.length > 0 && (
          <div className="mt-8">
            <TypographyH2>Saved Tables</TypographyH2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              <AnimatePresence initial={false}>
                {savedTables.map((table, index) => (
                  <motion.div
                    key={table.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: {
                        delay: Math.min(index * 0.05, 0.3), // Cap staggered delay
                        duration: 0.15,
                      },
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.9,
                      transition: { duration: 0.15 },
                    }}
                    className="w-full"
                  >
                    <Card className="overflow-hidden h-full">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center mb-2">
                          <h3
                            className="font-medium truncate"
                            title={table.name}
                          >
                            {table.name}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {new Date(table.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p
                          className="text-sm text-gray-500 mb-4 truncate"
                          title={table.input}
                        >
                          {table.input.substring(0, 50)}
                          {table.input.length > 50 ? "..." : ""}
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restoreTable(table)}
                            aria-label={`Restore table ${table.name}`}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" /> Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => confirmDeleteTable(table.id)}
                            aria-label={`Delete table ${table.name}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this table? This action can be
                undone for a short time after deletion.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleDeleteCancelled}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirmed}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default TableFormatter;
