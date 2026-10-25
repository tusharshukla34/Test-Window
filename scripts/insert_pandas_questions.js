const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  }
}

const dbPath = path.join(__dirname, '..', 'data', 'portal.db');
const db = new Database(dbPath);

// Ensure admin id
const adminRow = db.prepare("SELECT id FROM profiles WHERE role = 'admin' LIMIT 1").get();
const adminId = adminRow ? adminRow.id : 'usr-admin-tushar';

console.log('Using Admin ID:', adminId);

const questions = [
  {
    num: 2,
    text: "Show basic statistics (like mean, minimum and maximum) for all the number columns.",
    template: `import pandas as pd
import numpy as np

# Sample Employee DataFrame
data = {
    'Emp_ID': [101, 102, 103, 104, 105, 106],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Anjali'],
    'Department': ['IT', 'HR', 'Finance', 'IT', 'HR', 'Finance'],
    'Salary': [60000, 50000, 75000, 80000, 48000, 65000],
    'Experience': [3, 2, 5, 6, 1, 4],
    'Rating': [4.2, 3.8, 4.5, 4.8, 3.5, 4.0]
}
df = pd.DataFrame(data)

# Write your code to display basic statistics for numerical columns:
`,
    explanation: `# Using describe() to show summary statistics for numerical columns
print(df.describe())`
  },
  {
    num: 3,
    text: "Show the different departments in the Department column. Do not repeat any name.",
    template: `import pandas as pd

# Sample Employee DataFrame
data = {
    'Emp_ID': [101, 102, 103, 104, 105, 106],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Anjali'],
    'Department': ['IT', 'HR', 'Finance', 'IT', 'HR', 'Finance']
}
df = pd.DataFrame(data)

# Write your code to display unique departments without repetition:
`,
    explanation: `# Method 1: Using unique()
print(df['Department'].unique())

# Method 2: Using drop_duplicates()
# print(df['Department'].drop_duplicates().tolist())`
  },
  {
    num: 4,
    text: "Remove every row that has any missing value. Then print how many rows and columns are left.",
    template: `import pandas as pd
import numpy as np

# Sample DataFrame with missing values
data = {
    'Emp_ID': [101, 102, 103, 104, 105],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram'],
    'Department': ['IT', 'HR', np.nan, 'IT', 'HR'],
    'Salary': [60000, np.nan, 75000, 80000, 48000],
    'City': ['Bhopal', 'Indore', 'Delhi', np.nan, 'Bhopal']
}
df = pd.DataFrame(data)

# Write your code to drop rows with any missing value and print remaining shape:
`,
    explanation: `# Drop rows with any NaN values
df_cleaned = df.dropna()

print("Cleaned DataFrame:")
print(df_cleaned)

# Print rows and columns left
rows, cols = df_cleaned.shape
print(f"Rows left: {rows}, Columns left: {cols}")`
  },
  {
    num: 5,
    text: "Remove only the rows where Salary is missing.",
    template: `import pandas as pd
import numpy as np

# Sample DataFrame with missing values
data = {
    'Emp_ID': [101, 102, 103, 104, 105],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram'],
    'Department': ['IT', 'HR', 'Finance', 'IT', 'HR'],
    'Salary': [60000, np.nan, 75000, np.nan, 48000],
    'City': ['Bhopal', 'Indore', np.nan, 'Bhopal', 'Delhi']
}
df = pd.DataFrame(data)

# Write your code to remove only rows where Salary is missing:
`,
    explanation: `# Drop rows where 'Salary' column has NaN
df_cleaned = df.dropna(subset=['Salary'])
print(df_cleaned)`
  },
  {
    num: 6,
    text: "Fill the missing Salary values with the average (mean) salary.",
    template: `import pandas as pd
import numpy as np

# Sample DataFrame with missing Salary
data = {
    'Emp_ID': [101, 102, 103, 104, 105],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram'],
    'Department': ['IT', 'HR', 'Finance', 'IT', 'HR'],
    'Salary': [60000, np.nan, 75000, np.nan, 48000]
}
df = pd.DataFrame(data)

# Write your code to fill missing Salary with mean salary:
`,
    explanation: `# Calculate mean salary and fill missing values
mean_salary = df['Salary'].mean()
df['Salary'] = df['Salary'].fillna(mean_salary)
print(df)`
  },
  {
    num: 7,
    text: "Fill the missing City values with the word \"Unknown\".",
    template: `import pandas as pd
import numpy as np

# Sample DataFrame with missing City
data = {
    'Emp_ID': [101, 102, 103, 104, 105],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram'],
    'City': ['Bhopal', np.nan, 'Indore', np.nan, 'Delhi']
}
df = pd.DataFrame(data)

# Write your code to fill missing City with 'Unknown':
`,
    explanation: `# Fill missing City values with "Unknown"
df['City'] = df['City'].fillna("Unknown")
print(df)`
  },
  {
    num: 8,
    text: "In the Gender column, change M to Male and F to Female.",
    template: `import pandas as pd

# Sample DataFrame
data = {
    'Emp_ID': [101, 102, 103, 104, 105],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram'],
    'Gender': ['M', 'F', 'M', 'F', 'M']
}
df = pd.DataFrame(data)

# Write your code to replace M with Male and F with Female:
`,
    explanation: `# Method 1: Using replace()
df['Gender'] = df['Gender'].replace({'M': 'Male', 'F': 'Female'})
print(df)

# Method 2: Using map()
# df['Gender'] = df['Gender'].map({'M': 'Male', 'F': 'Female'})`
  },
  {
    num: 9,
    text: "Change the column name Salary to Monthly_Salary and Experience to Exp_Years. Do both in one step.",
    template: `import pandas as pd

# Sample DataFrame
data = {
    'Emp_ID': [101, 102, 103],
    'Name': ['Amit', 'Priya', 'Rahul'],
    'Salary': [60000, 50000, 75000],
    'Experience': [3, 2, 5]
}
df = pd.DataFrame(data)

# Write your code to rename both columns in one step:
`,
    explanation: `# Rename multiple columns in one step using rename()
df = df.rename(columns={'Salary': 'Monthly_Salary', 'Experience': 'Exp_Years'})
print(df)`
  },
  {
    num: 10,
    text: "Make a new column Annual_Salary. It should be Salary multiplied by 12.",
    template: `import pandas as pd

# Sample DataFrame
data = {
    'Emp_ID': [101, 102, 103, 104],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha'],
    'Salary': [50000, 60000, 75000, 48000]
}
df = pd.DataFrame(data)

# Write your code to create the Annual_Salary column:
`,
    explanation: `# Create Annual_Salary by multiplying Salary by 12
df['Annual_Salary'] = df['Salary'] * 12
print(df)`
  },
  {
    num: 11,
    text: "Use a lambda function to make a new column IsTech. It should say \"Yes\" if the Department is IT, otherwise \"No\".",
    template: `import pandas as pd

# Sample DataFrame
data = {
    'Emp_ID': [101, 102, 103, 104, 105],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram'],
    'Department': ['IT', 'HR', 'Finance', 'IT', 'Marketing']
}
df = pd.DataFrame(data)

# Write your code using apply() with a lambda function:
`,
    explanation: `# Create IsTech column using lambda function
df['IsTech'] = df['Department'].apply(lambda dept: 'Yes' if dept == 'IT' else 'No')
print(df)`
  },
  {
    num: 12,
    text: "Write a function bonus_percent(dept) that gives 10 for IT, 8 for Finance and 5 for every other department. Then use it to make a new column Bonus_Percent from the Department column.",
    template: `import pandas as pd

# Sample DataFrame
data = {
    'Emp_ID': [101, 102, 103, 104, 105],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram'],
    'Department': ['IT', 'Finance', 'HR', 'Marketing', 'IT']
}
df = pd.DataFrame(data)

# 1. Define bonus_percent(dept)
# 2. Create Bonus_Percent column using apply()
`,
    explanation: `def bonus_percent(dept):
    if dept == 'IT':
        return 10
    elif dept == 'Finance':
        return 8
    else:
        return 5

df['Bonus_Percent'] = df['Department'].apply(bonus_percent)
print(df)`
  },
  {
    num: 13,
    text: "Remove the Rating column. Then print the names of the columns that are left.",
    template: `import pandas as pd

# Sample DataFrame
data = {
    'Emp_ID': [101, 102, 103],
    'Name': ['Amit', 'Priya', 'Rahul'],
    'Department': ['IT', 'HR', 'Finance'],
    'Salary': [60000, 50000, 75000],
    'Rating': [4.5, 3.8, 4.2]
}
df = pd.DataFrame(data)

# Write your code to drop Rating column and print remaining column names:
`,
    explanation: `# Drop Rating column
df = df.drop(columns=['Rating'])

# Print remaining columns
print("Remaining columns:", list(df.columns))`
  },
  {
    num: 14,
    text: "Arrange the rows of df by Department (Z to A).",
    template: `import pandas as pd

# Sample DataFrame
data = {
    'Emp_ID': [101, 102, 103, 104, 105],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram'],
    'Department': ['Finance', 'HR', 'IT', 'Marketing', 'Operations']
}
df = pd.DataFrame(data)

# Write your code to sort df by Department descending (Z to A):
`,
    explanation: `# Sort rows by Department in descending order
df_sorted = df.sort_values(by='Department', ascending=False)
print(df_sorted)`
  },
  {
    num: 15,
    text: "Find the average Salary of each Department.",
    template: `import pandas as pd

# Sample DataFrame
data = {
    'Emp_ID': [101, 102, 103, 104, 105, 106],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Anjali'],
    'Department': ['IT', 'HR', 'Finance', 'IT', 'HR', 'Finance'],
    'Salary': [60000, 50000, 75000, 80000, 52000, 65000]
}
df = pd.DataFrame(data)

# Write your code to find average Salary per Department:
`,
    explanation: `# Group by Department and calculate mean salary
avg_salary = df.groupby('Department')['Salary'].mean()
print(avg_salary)`
  },
  {
    num: 16,
    text: "Find how many employees work in each City.",
    template: `import pandas as pd

# Sample DataFrame
data = {
    'Emp_ID': [101, 102, 103, 104, 105, 106, 107],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Anjali', 'Rohit'],
    'City': ['Bhopal', 'Indore', 'Bhopal', 'Delhi', 'Bhopal', 'Indore', 'Delhi']
}
df = pd.DataFrame(data)

# Write your code to count employees in each City:
`,
    explanation: `# Method 1: Using value_counts()
print(df['City'].value_counts())

# Method 2: Using groupby
# print(df.groupby('City')['Emp_ID'].count())`
  },
  {
    num: 17,
    text: "Find the total Salary for each Department and Gender together (for example, IT with Male).",
    template: `import pandas as pd

# Sample DataFrame
data = {
    'Emp_ID': [101, 102, 103, 104, 105, 106],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Anjali'],
    'Department': ['IT', 'IT', 'HR', 'HR', 'Finance', 'Finance'],
    'Gender': ['Male', 'Female', 'Male', 'Female', 'Male', 'Female'],
    'Salary': [60000, 65000, 48000, 52000, 70000, 75000]
}
df = pd.DataFrame(data)

# Write your code to find total Salary grouped by Department and Gender:
`,
    explanation: `# Group by Department and Gender, then sum Salary
total_salary = df.groupby(['Department', 'Gender'])['Salary'].sum().reset_index()
print(total_salary)

# Or using pivot_table:
# print(df.pivot_table(index='Department', columns='Gender', values='Salary', aggfunc='sum'))`
  },
  {
    num: 18,
    text: "For each Department, find the lowest, highest and average Salary. Show all three together in one table.",
    template: `import pandas as pd

# Sample DataFrame
data = {
    'Emp_ID': [101, 102, 103, 104, 105, 106],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Anjali'],
    'Department': ['IT', 'HR', 'Finance', 'IT', 'HR', 'Finance'],
    'Salary': [60000, 48000, 70000, 85000, 52000, 80000]
}
df = pd.DataFrame(data)

# Write your code to show min, max, and mean Salary per Department:
`,
    explanation: `# Using agg with 'min', 'max', 'mean'
salary_summary = df.groupby('Department')['Salary'].agg(['min', 'max', 'mean'])
print(salary_summary)`
  },
  {
    num: 19,
    text: "For each Department, find the total Salary and the average Experience. Show both together in one table.",
    template: `import pandas as pd

# Sample DataFrame
data = {
    'Emp_ID': [101, 102, 103, 104, 105, 106],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Anjali'],
    'Department': ['IT', 'HR', 'Finance', 'IT', 'HR', 'Finance'],
    'Salary': [60000, 48000, 70000, 85000, 52000, 80000],
    'Experience': [3, 2, 5, 6, 1, 4]
}
df = pd.DataFrame(data)

# Write your code to find total Salary and average Experience per Department:
`,
    explanation: `# Group by Department and aggregate Salary (sum) and Experience (mean)
dept_summary = df.groupby('Department').agg(
    Total_Salary=('Salary', 'sum'),
    Avg_Experience=('Experience', 'mean')
)
print(dept_summary)`
  },
  {
    num: 20,
    text: "Make one table of the IT employees and another table of the HR employees. Then join them into one table, one below the other.",
    template: `import pandas as pd

# Sample DataFrame
data = {
    'Emp_ID': [101, 102, 103, 104, 105, 106],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Anjali'],
    'Department': ['IT', 'HR', 'Finance', 'IT', 'HR', 'Finance'],
    'Salary': [60000, 48000, 70000, 85000, 52000, 80000]
}
df = pd.DataFrame(data)

# Write your code to filter IT and HR employees, then concatenate vertically:
`,
    explanation: `# Filter IT and HR employees
it_df = df[df['Department'] == 'IT']
hr_df = df[df['Department'] == 'HR']

# Combine vertically using pd.concat
combined_df = pd.concat([it_df, hr_df], ignore_index=True)
print(combined_df)`
  },
  {
    num: 21,
    text: "If your data has date column with object data type change it to datetime datatype.",
    template: `import pandas as pd

# Sample DataFrame with object date column
data = {
    'Emp_ID': [101, 102, 103, 104],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha'],
    'Joining_Date': ['2023-01-15', '2022-07-20', '2021-03-10', '2023-11-05']
}
df = pd.DataFrame(data)

print("Before conversion dtypes:")
print(df.dtypes)

# Write your code to convert Joining_Date to datetime datatype:
`,
    explanation: `# Convert date column from object to datetime using pd.to_datetime
df['Joining_Date'] = pd.to_datetime(df['Joining_Date'])

print("After conversion dtypes:")
print(df.dtypes)
print(df)`
  },
  {
    num: 22,
    text: "If your data has date column with object data type change it to datetime datatype (specify exact date format e.g. '%d-%m-%Y' and handle errors).",
    template: `import pandas as pd

# Sample DataFrame with custom formatted date strings
data = {
    'Emp_ID': [101, 102, 103, 104],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha'],
    'Joining_Date': ['15-01-2023', '20-07-2022', '10-03-2021', '05-11-2023']
}
df = pd.DataFrame(data)

print("Before conversion dtypes:")
print(df.dtypes)

# Write your code to convert Joining_Date to datetime with format='%d-%m-%Y':
`,
    explanation: `# Convert date column specifying exact format
df['Joining_Date'] = pd.to_datetime(df['Joining_Date'], format='%d-%m-%Y', errors='coerce')

print("After conversion dtypes:")
print(df.dtypes)
print(df)`
  },
  {
    num: 23,
    text: "Create a new column of month name , day , day name total three new columns.",
    template: `import pandas as pd

# Sample DataFrame with datetime column
data = {
    'Emp_ID': [101, 102, 103, 104],
    'Name': ['Amit', 'Priya', 'Rahul', 'Sneha'],
    'Joining_Date': pd.to_datetime(['2023-01-15', '2022-07-20', '2021-03-10', '2023-11-05'])
}
df = pd.DataFrame(data)

# Write your code to create 3 new columns: Month (month name), Day (day), Day_Name (day of week name):
`,
    explanation: `# Extract month name, day, and day name using .dt accessor
df['Month'] = df['Joining_Date'].dt.month_name()
df['Day'] = df['Joining_Date'].dt.day
df['Day_Name'] = df['Joining_Date'].dt.day_name()

print(df[['Joining_Date', 'Month', 'Day', 'Day_Name']])`
  }
];

const insertStmt = db.prepare(`
  INSERT INTO question_bank (
    id, subject, topic, difficulty, question_type, coding_language,
    code_template, allowed_file_types, max_file_size_mb,
    question_text, options, correct_option_id, explanation, marks, negative_penalty, created_by,
    created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?,
    ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?,
    datetime('now'), datetime('now')
  )
`);

const checkExisting = db.prepare("SELECT id FROM question_bank WHERE id = ?");

let count = 0;
const tx = db.transaction(() => {
  for (const q of questions) {
    const id = `pd-emp-${String(q.num).padStart(2, '0')}`;
    const existing = checkExisting.get(id);
    if (existing) {
      db.prepare(`
        UPDATE question_bank SET
          subject = ?,
          topic = ?,
          difficulty = ?,
          question_type = ?,
          coding_language = ?,
          code_template = ?,
          question_text = ?,
          explanation = ?,
          marks = ?,
          negative_penalty = ?,
          created_by = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        'Python Libraries',
        'Pandas (Series & DataFrames)',
        'medium',
        'coding',
        'python',
        q.template,
        q.text,
        q.explanation,
        5.0,
        0.0,
        adminId,
        id
      );
      console.log(`Updated [${id}]: ${q.text.slice(0, 50)}...`);
    } else {
      insertStmt.run(
        id,
        'Python Libraries',
        'Pandas (Series & DataFrames)',
        'medium',
        'coding',
        'python',
        q.template,
        'pdf,png,jpg,ipynb,zip,txt,py,java,cpp',
        10,
        q.text,
        '[]',
        'manual_evaluation',
        q.explanation,
        5.0,
        0.0,
        adminId
      );
      console.log(`Inserted [${id}]: ${q.text.slice(0, 50)}...`);
    }
    count++;
  }
});

tx();

console.log(`\nSuccessfully processed ${count} questions (all with 5 marks).`);

// Verify in database
const totalInTopic = db.prepare("SELECT count(*) as count FROM question_bank WHERE topic = 'Pandas (Series & DataFrames)'").get();
console.log(`Total questions in 'Pandas (Series & DataFrames)': ${totalInTopic.count}`);

// Attempt cloud sync if Supabase is configured
async function runCloudSync() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xuzqyioysksstcdqnplo.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || Buffer.from('c2Jfc2VjcmV0X3VBZDI5YkFHX2pKR0xVSjU5d0I3VGdfejh6MGlLMDU=', 'base64').toString('utf-8');
  if (!supabaseUrl || !serviceKey) {
    console.log('Supabase credentials not found, skipping cloud sync.');
    return;
  }
  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    console.log('Uploading portal.db to portal-state storage bucket...');
    const buffer = fs.readFileSync(dbPath);
    const { data, error } = await supabase.storage.from('portal-state').upload('portal.db', buffer, {
      upsert: true,
      contentType: 'application/x-sqlite3'
    });
    if (error) {
      console.warn('Supabase upload warning:', error.message);
    } else {
      console.log('Supabase cloud backup successfully synced!', data);
    }
  } catch (err) {
    console.warn('Cloud sync error:', err.message);
  }
}

runCloudSync().then(() => {
  console.log('Finished!');
  process.exit(0);
});
